FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

# 先只放 pom.xml，让依赖层在源码变化时仍可复用
COPY pom.xml .
RUN mvn -B dependency:go-offline

COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app

RUN groupadd -r zcollab && useradd -r -g zcollab -d /app -s /sbin/nologin zcollab
COPY --from=build /build/target/server-0.0.1-SNAPSHOT.jar /app/app.jar

ENV ZCOLLAB_UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads && chown -R zcollab:zcollab /data

USER zcollab
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
