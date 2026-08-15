"""Aprovisiona la infraestructura de LupIA en AWS (idempotente: re-ejecutable).

    python scripts/desplegar_aws.py

Crea (si no existen): security groups, RDS Postgres db.t4g.micro, roles IAM,
cluster ECS Fargate, task definition + servicio de la API, ALB con health check
en /salud, y WAF con reglas administradas + rate limit, asociado al ALB.
La UI va aparte por Amplify Hosting apuntando LUPIA_API_URL al DNS del ALB.

Requiere: credenciales AWS con permisos amplios (usuario LupIA) y el .env local
para copiar las variables de la API a la task definition.
"""
import json
import secrets
import sys
import time
from pathlib import Path

import boto3

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

from engine import config  # lee el .env local  # noqa: E402

REGION = "us-east-1"
CUENTA = "893403372672"
REGISTRO = f"{CUENTA}.dkr.ecr.{REGION}.amazonaws.com"

ec2 = boto3.client("ec2", region_name=REGION)
rds = boto3.client("rds", region_name=REGION)
iam = boto3.client("iam")
ecs = boto3.client("ecs", region_name=REGION)
elb = boto3.client("elbv2", region_name=REGION)
waf = boto3.client("wafv2", region_name=REGION)
logs = boto3.client("logs", region_name=REGION)

DEPLOY_STATE = Path(__file__).resolve().parent.parent / ".env.deploy"


def estado_guardado() -> dict:
    if DEPLOY_STATE.exists():
        return dict(l.split("=", 1) for l in DEPLOY_STATE.read_text().splitlines() if "=" in l)
    return {}


def guardar_estado(**kv) -> None:
    estado = estado_guardado()
    estado.update(kv)
    DEPLOY_STATE.write_text("\n".join(f"{k}={v}" for k, v in estado.items()) + "\n")


def paso(msg: str) -> None:
    print(f"\n=== {msg} ===", flush=True)


# ---------- 1. Red: VPC por defecto + security groups ----------

paso("Red")
vpc = ec2.describe_vpcs(Filters=[{"Name": "isDefault", "Values": ["true"]}])["Vpcs"][0]["VpcId"]
subredes = [s["SubnetId"] for s in ec2.describe_subnets(
    Filters=[{"Name": "vpc-id", "Values": [vpc]}])["Subnets"]][:3]
print(f"VPC {vpc} · subredes {subredes}")


def sg(nombre: str, descripcion: str) -> str:
    existentes = ec2.describe_security_groups(
        Filters=[{"Name": "group-name", "Values": [nombre]}, {"Name": "vpc-id", "Values": [vpc]}]
    )["SecurityGroups"]
    if existentes:
        return existentes[0]["GroupId"]
    return ec2.create_security_group(GroupName=nombre, Description=descripcion, VpcId=vpc)["GroupId"]


def permitir(sg_id: str, puerto: int, origen_sg: str | None = None, cidr: str | None = None) -> None:
    regla: dict = {"IpProtocol": "tcp", "FromPort": puerto, "ToPort": puerto}
    if origen_sg:
        regla["UserIdGroupPairs"] = [{"GroupId": origen_sg}]
    else:
        regla["IpRanges"] = [{"CidrIp": cidr or "0.0.0.0/0"}]
    try:
        ec2.authorize_security_group_ingress(GroupId=sg_id, IpPermissions=[regla])
    except ec2.exceptions.ClientError as e:
        if "Duplicate" not in str(e):
            raise


sg_alb = sg("lupia-alb-sg", "LupIA ALB publico")
sg_svc = sg("lupia-svc-sg", "LupIA servicios ECS")
sg_db = sg("lupia-db-sg", "LupIA RDS")
permitir(sg_alb, 80)
permitir(sg_alb, 443)
permitir(sg_svc, 8010, origen_sg=sg_alb)
permitir(sg_db, 5432, origen_sg=sg_svc)
print(f"SGs: alb={sg_alb} svc={sg_svc} db={sg_db}")

# ---------- 2. RDS Postgres (lo mas chico) ----------

paso("RDS Postgres db.t4g.micro")
estado = estado_guardado()
clave_db = estado.get("DB_CLAVE") or secrets.token_hex(16)
guardar_estado(DB_CLAVE=clave_db)
try:
    rds.create_db_instance(
        DBInstanceIdentifier="lupia-db",
        DBInstanceClass="db.t4g.micro",
        Engine="postgres",
        EngineVersion="16",
        AllocatedStorage=20,
        StorageType="gp3",
        MasterUsername="lupia",
        MasterUserPassword=clave_db,
        DBName="lupia",
        VpcSecurityGroupIds=[sg_db],
        PubliclyAccessible=False,
        MultiAZ=False,
        BackupRetentionPeriod=1,
        StorageEncrypted=True,
    )
    print("Creando lupia-db (5-10 min)...")
except rds.exceptions.DBInstanceAlreadyExistsFault:
    print("lupia-db ya existe")

# ---------- 3. Roles IAM ----------

paso("Roles IAM")
CONFIANZA = json.dumps({
    "Version": "2012-10-17",
    "Statement": [{"Effect": "Allow", "Principal": {"Service": "ecs-tasks.amazonaws.com"},
                   "Action": "sts:AssumeRole"}],
})


def rol(nombre: str) -> str:
    try:
        return iam.create_role(RoleName=nombre, AssumeRolePolicyDocument=CONFIANZA)["Role"]["Arn"]
    except iam.exceptions.EntityAlreadyExistsException:
        return iam.get_role(RoleName=nombre)["Role"]["Arn"]


rol_exec = rol("lupia-exec-role")
iam.attach_role_policy(RoleName="lupia-exec-role",
                       PolicyArn="arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy")
rol_task = rol("lupia-task-role")
iam.put_role_policy(
    RoleName="lupia-task-role", PolicyName="lupia-bedrock",
    PolicyDocument=json.dumps({
        "Version": "2012-10-17",
        "Statement": [{"Effect": "Allow",
                       "Action": ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream",
                                  "bedrock:Converse", "bedrock:ConverseStream"],
                       "Resource": "*"}],
    }),
)
print(f"exec={rol_exec}\ntask={rol_task}")

# ---------- 4. ALB + target group ----------

paso("ALB")
try:
    alb = elb.create_load_balancer(Name="lupia-alb", Subnets=subredes, SecurityGroups=[sg_alb],
                                   Scheme="internet-facing", Type="application")["LoadBalancers"][0]
except elb.exceptions.DuplicateLoadBalancerNameException:
    alb = elb.describe_load_balancers(Names=["lupia-alb"])["LoadBalancers"][0]
alb_arn, alb_dns = alb["LoadBalancerArn"], alb["DNSName"]
try:
    tg = elb.create_target_group(Name="lupia-api-tg", Protocol="HTTP", Port=8010, VpcId=vpc,
                                 TargetType="ip", HealthCheckPath="/salud",
                                 HealthCheckIntervalSeconds=30)["TargetGroups"][0]
except elb.exceptions.DuplicateTargetGroupNameException:
    tg = elb.describe_target_groups(Names=["lupia-api-tg"])["TargetGroups"][0]
tg_arn = tg["TargetGroupArn"]
listeners = elb.describe_listeners(LoadBalancerArn=alb_arn)["Listeners"]
if not listeners:
    elb.create_listener(LoadBalancerArn=alb_arn, Protocol="HTTP", Port=80,
                        DefaultActions=[{"Type": "forward", "TargetGroupArn": tg_arn}])
print(f"ALB: http://{alb_dns}")
guardar_estado(ALB_DNS=alb_dns)

# ---------- 5. WAF ----------

paso("WAF")
reglas = []
for i, (nombre, grupo) in enumerate([
    ("Common", "AWSManagedRulesCommonRuleSet"),
    ("BadInputs", "AWSManagedRulesKnownBadInputsRuleSet"),
    ("IpReputation", "AWSManagedRulesAmazonIpReputationList"),
]):
    reglas.append({
        "Name": nombre, "Priority": i,
        "Statement": {"ManagedRuleGroupStatement": {"VendorName": "AWS", "Name": grupo}},
        "OverrideAction": {"None": {}},
        "VisibilityConfig": {"SampledRequestsEnabled": True, "CloudWatchMetricsEnabled": True,
                             "MetricName": f"lupia{nombre}"},
    })
reglas.append({
    "Name": "RateLimit", "Priority": 10,
    "Statement": {"RateBasedStatement": {"Limit": 2000, "AggregateKeyType": "IP"}},
    "Action": {"Block": {}},
    "VisibilityConfig": {"SampledRequestsEnabled": True, "CloudWatchMetricsEnabled": True,
                         "MetricName": "lupiaRate"},
})
acls = waf.list_web_acls(Scope="REGIONAL")["WebACLs"]
existente = next((a for a in acls if a["Name"] == "lupia-waf"), None)
if existente:
    acl_arn = existente["ARN"]
else:
    acl_arn = waf.create_web_acl(
        Name="lupia-waf", Scope="REGIONAL",
        DefaultAction={"Allow": {}}, Rules=reglas,
        VisibilityConfig={"SampledRequestsEnabled": True, "CloudWatchMetricsEnabled": True,
                          "MetricName": "lupiaWaf"},
    )["Summary"]["ARN"]
# El ALB recien creado tarda en ser visible para WAF: reintentar y VERIFICAR
asociado = waf.get_web_acl_for_resource(ResourceArn=alb_arn).get("WebACL")
for intento in range(15):
    if asociado:
        break
    try:
        waf.associate_web_acl(WebACLArn=acl_arn, ResourceArn=alb_arn)
    except waf.exceptions.WAFUnavailableEntityException:
        print(f"  ALB aun aprovisionando para WAF, reintento {intento + 1}/15...", flush=True)
        time.sleep(30)
    asociado = waf.get_web_acl_for_resource(ResourceArn=alb_arn).get("WebACL")
print(f"WAF asociado al ALB: {'SI' if asociado else 'NO - reintentar luego'}")

# ---------- 6. Esperar RDS y armar DATABASE_URL ----------

paso("Esperando RDS disponible")
while True:
    db = rds.describe_db_instances(DBInstanceIdentifier="lupia-db")["DBInstances"][0]
    if db["DBInstanceStatus"] == "available":
        break
    print(f"  estado: {db['DBInstanceStatus']}...", flush=True)
    time.sleep(30)
endpoint = db["Endpoint"]["Address"]
database_url = f"postgresql://lupia:{clave_db}@{endpoint}:5432/lupia"
guardar_estado(RDS_ENDPOINT=endpoint)
print(f"RDS: {endpoint}")

# ---------- 7. ECS: cluster, task definition, servicio ----------

paso("ECS Fargate")
# Primera vez que la cuenta usa ECS: crear el service-linked role explicitamente
try:
    iam.create_service_linked_role(AWSServiceName="ecs.amazonaws.com")
    print("Service-linked role de ECS creado (primera vez)")
    time.sleep(10)
except iam.exceptions.InvalidInputException:
    pass  # ya existe
ecs.create_cluster(clusterName="lupia")
try:
    logs.create_log_group(logGroupName="/ecs/lupia-api")
except logs.exceptions.ResourceAlreadyExistsException:
    pass

jwt_prod = estado_guardado().get("JWT_SECRETO") or secrets.token_hex(32)
guardar_estado(JWT_SECRETO=jwt_prod)

entorno = [
    {"name": "DATABASE_URL", "value": database_url},
    {"name": "MODO_DEMO", "value": "0"},
    {"name": "AMBITO_INGESTA", "value": config.AMBITO_INGESTA},
    {"name": "FECHA_SISMO", "value": config.FECHA_SISMO},
    {"name": "SODA_APP_TOKEN", "value": config.SODA_APP_TOKEN},
    {"name": "BREVO_API_KEY", "value": config.BREVO_API_KEY},
    {"name": "CORREO_REMITENTE", "value": config.CORREO_REMITENTE},
    {"name": "NOMBRE_REMITENTE", "value": config.NOMBRE_REMITENTE},
    {"name": "JWT_SECRETO", "value": jwt_prod},
    {"name": "GOOGLE_CLIENT_ID", "value": config.GOOGLE_CLIENT_ID},
    {"name": "IA_PROVEEDOR", "value": config.IA_PROVEEDOR},
    {"name": "NOVA_MODEL_ID", "value": config.NOVA_MODEL_ID},
    {"name": "BEDROCK_MODEL_ID", "value": config.BEDROCK_MODEL_ID},
    {"name": "AWS_REGION", "value": REGION},
]
taskdef = ecs.register_task_definition(
    family="lupia-api",
    networkMode="awsvpc",
    requiresCompatibilities=["FARGATE"],
    cpu="256", memory="512",
    executionRoleArn=rol_exec,
    taskRoleArn=rol_task,
    containerDefinitions=[{
        "name": "api",
        "image": f"{REGISTRO}/lupia-api:latest",
        "portMappings": [{"containerPort": 8010, "protocol": "tcp"}],
        "environment": entorno,
        "logConfiguration": {"logDriver": "awslogs", "options": {
            "awslogs-group": "/ecs/lupia-api", "awslogs-region": REGION,
            "awslogs-stream-prefix": "api"}},
    }],
)["taskDefinition"]["taskDefinitionArn"]

red = {"awsvpcConfiguration": {"subnets": subredes, "securityGroups": [sg_svc],
                               "assignPublicIp": "ENABLED"}}
servicios = ecs.describe_services(cluster="lupia", services=["lupia-api"])["services"]
if servicios and servicios[0]["status"] == "ACTIVE":
    ecs.update_service(cluster="lupia", service="lupia-api", taskDefinition=taskdef,
                       desiredCount=1, forceNewDeployment=True)
    print("Servicio actualizado")
else:
    for intento in range(6):
        try:
            ecs.create_service(
                cluster="lupia", serviceName="lupia-api", taskDefinition=taskdef,
                desiredCount=1, launchType="FARGATE", networkConfiguration=red,
                loadBalancers=[{"targetGroupArn": tg_arn, "containerName": "api",
                                "containerPort": 8010}],
                healthCheckGracePeriodSeconds=60,
            )
            print("Servicio creado")
            break
        except ecs.exceptions.InvalidParameterException as e:
            if "service linked role" not in str(e):
                raise
            print(f"  Esperando el service-linked role de ECS ({intento + 1}/6)...", flush=True)
            time.sleep(15)

paso("LISTO")
print(f"API (cuando el target este healthy, ~2 min): http://{alb_dns}/salud")
print(f"Swagger: http://{alb_dns}/docs")
print("Siguiente: ingesta inicial ->")
print('  aws ecs run-task con override: python scripts/ingesta_completa.py (o POST /ingesta/terremoto)')
print("Amplify (UI): conectar repo con appRoot ui/ y LUPIA_API_URL=http://" + alb_dns)
