// Panel web ALERTA MUJER (Angular): build de producción, pruebas y, en main, despliegue en Vercel
// con su "deploy hook" (credencial vercel-deploy-hook en Jenkins).
pipeline {
  agent any
  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '15'))
    disableConcurrentBuilds()
  }

  stages {
    stage('Dependencias') {
      steps {
        dir('alerta-mujer-web') {
          sh 'npm ci --no-audit --no-fund'
        }
      }
    }

    stage('Build') {
      steps {
        dir('alerta-mujer-web') {
          sh 'npx ng build --configuration production'
        }
      }
    }

    stage('Pruebas') {
      steps {
        dir('alerta-mujer-web') {
          sh 'npx ng test --watch=false'
        }
      }
    }

    stage('Desplegar en Vercel') {
      when { branch 'main' }
      steps {
        script {
          try {
            withCredentials([string(credentialsId: 'vercel-deploy-hook', variable: 'HOOK')]) {
              sh 'curl -fsS -X POST "$HOOK" > /dev/null'
            }
            echo 'Despliegue en Vercel solicitado.'
          } catch (org.jenkinsci.plugins.credentialsbinding.impl.CredentialNotFoundException e) {
            echo 'No hay credencial vercel-deploy-hook: se omite el despliegue.'
          }
        }
      }
    }
  }

  post {
    always { cleanWs() }
  }
}
