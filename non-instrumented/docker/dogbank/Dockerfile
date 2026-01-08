# --- STAGE 1: build all modules ---
FROM maven:3.9.7-eclipse-temurin-17 AS builder
WORKDIR /app

# 1) copia todo o código
COPY . .

# 2) instala o bancocentral-module no repositório local
RUN mvn -f bancocentral-module/pom.xml clean install -DskipTests

# 3) compila e empacota o pom raiz (que engloba auth, account, transaction, etc)
RUN mvn clean package -DskipTests

# --- STAGE 2: runtime com JRE Debian-slim multi-arch ---
FROM eclipse-temurin:17-jre
WORKDIR /app

# copia os jars prontos
COPY --from=builder /app/auth-module/target/auth-module-1.0-SNAPSHOT.jar          auth-module.jar
COPY --from=builder /app/account-module/target/account-module-1.0-SNAPSHOT.jar    account-module.jar
COPY --from=builder /app/integration-module/target/integration-module-1.0-SNAPSHOT.jar integration-module.jar
COPY --from=builder /app/notification-module/target/notification-module-1.0-SNAPSHOT.jar notification-module.jar
COPY --from=builder /app/transaction-module/target/transaction-module-1.0-SNAPSHOT.jar transaction-module.jar
COPY --from=builder /app/bancocentral-module/target/bancocentral-module-1.0-SNAPSHOT.jar bancocentral-module.jar

# script de startup
COPY start-all.sh .
RUN chmod +x start-all.sh

EXPOSE 8081 8082 8083 8084 8085 8088 8089
CMD ["./start-all.sh"]
