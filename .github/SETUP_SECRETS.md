# Configurar Secrets do GitHub para Deploy Automático

Para que o GitHub Actions possa fazer o rollout automático dos pods no EKS após cada build, você precisa adicionar os seguintes secrets no repositório.

## Secrets Necessários

Vá em: **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### 1. AWS_ACCESS_KEY_ID
- **Nome**: `AWS_ACCESS_KEY_ID`
- **Valor**: Sua AWS Access Key ID com permissões para EKS

### 2. AWS_SECRET_ACCESS_KEY
- **Nome**: `AWS_SECRET_ACCESS_KEY`
- **Valor**: Sua AWS Secret Access Key correspondente

### 3. DOCKERHUB_USERNAME (já deve existir)
- **Nome**: `DOCKERHUB_USERNAME`
- **Valor**: Seu username do Docker Hub

### 4. DOCKERHUB_TOKEN (já deve existir)
- **Nome**: `DOCKERHUB_TOKEN`
- **Valor**: Seu token de acesso do Docker Hub

## Permissões IAM Necessárias

A AWS IAM user/role usada precisa ter as seguintes permissões:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "eks:DescribeCluster",
        "eks:ListClusters"
      ],
      "Resource": "*"
    }
  ]
}
```

**IMPORTANTE**: A user/role também precisa estar mapeada no ConfigMap `aws-auth` do cluster EKS para ter permissão de executar comandos kubectl.

## Como Mapear a User no ConfigMap aws-auth

1. Edite o ConfigMap:
```bash
kubectl edit configmap aws-auth -n kube-system
```

2. Adicione sua IAM user na seção `mapUsers`:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: aws-auth
  namespace: kube-system
data:
  mapUsers: |
    - userarn: arn:aws:iam::061039767542:user/github-actions-dogbank
      username: github-actions-dogbank
      groups:
        - system:masters
```

## Como Funciona

Após configurar os secrets, o workflow automático irá:

1. ✅ **Build** - Fazer build de todas as imagens Docker (backend + frontend)
2. ✅ **Push** - Enviar as imagens para Docker Hub com tags `latest` e `<git-sha>`
3. ✅ **Deploy** - Conectar no cluster EKS e fazer rollout restart de todos os deployments
4. ✅ **Verify** - Aguardar todos os pods ficarem prontos e verificar status

## Alternativa: Usar IAM Role com OIDC (Recomendado para Produção)

Para produção, é mais seguro usar OIDC ao invés de access keys:

1. Configure OIDC provider no AWS IAM
2. Crie uma role com trust relationship para GitHub Actions
3. Use `aws-actions/configure-aws-credentials@v4` com `role-to-assume`

## Teste

Após configurar os secrets, faça um push para `main` e acompanhe em:
**Actions** → **docker-publish** → Visualizar o log do job "Deploy to EKS"
