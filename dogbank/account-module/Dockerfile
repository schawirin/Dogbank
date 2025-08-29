FROM openjdk:17-jdk-slim

# Copia o JAR do serviço para a imagem
COPY target/account-module-1.0-SNAPSHOT.jar /app.jar

# Expõe a porta 8089 (conforme definido em application.properties)
EXPOSE 8089

# Define o entrypoint para executar o JAR
ENTRYPOINT ["java", "-jar", "/app.jar"]
