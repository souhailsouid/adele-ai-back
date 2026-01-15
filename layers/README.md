# Lambda Layers

Ce dossier contient les Lambda Layers réutilisables pour les fonctions Lambda.

## Structure

```
layers/
├── parquetjs-layer/
│   ├── nodejs/
│   │   └── node_modules/
│   │       └── parquetjs/
│   ├── parquetjs-layer.zip
│   ├── rebuild.sh
│   └── package.json
└── README.md
```

## parquetjs-layer

Layer contenant la bibliothèque `parquetjs` pour les opérations sur fichiers Parquet.

### Utilisation

La layer est automatiquement attachée à la Lambda API via Terraform (`infra/terraform/lambda-layers.tf`).

### Rebuild

Pour mettre à jour la layer après modification des dépendances :

```bash
cd layers/parquetjs-layer
./rebuild.sh
```

Puis déployer avec Terraform :

```bash
cd infra/terraform
terraform apply -target=aws_lambda_layer_version.parquetjs_layer
```

### Structure requise

AWS Lambda Layers nécessite une structure spécifique :
- `nodejs/node_modules/parquetjs/` → disponible dans `/opt/nodejs/node_modules/parquetjs` dans la Lambda

### Avantages

- ✅ Réduit la taille du bundle Lambda (parquetjs ~1.1MB)
- ✅ Réutilisable pour plusieurs Lambdas
- ✅ Mise à jour centralisée
- ✅ Meilleure séparation des dépendances
