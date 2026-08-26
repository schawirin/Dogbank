# DogBank Terraform Bootstrap

Creates the S3 bucket + DynamoDB table used as the remote-state backend for
`instrumented/terraform/aws/`. This is the **one** tree in the project
allowed to keep local state — it bootstraps remote state for everything
else, so nothing else exists yet for it to use.

## Usage

Apply this once, by hand, with admin credentials for the **new** AWS
account:

```
terraform init
terraform apply
```

Then copy the three outputs (`bucket_name`, `bucket_arn`, `table_name`)
into the sibling `instrumented/terraform/aws/backend.tf` file, replacing
its `REPLACE_WITH_*` placeholder values.

Finally, run `terraform init` inside `instrumented/terraform/aws/` — it
will detect the new `backend "s3"` block and offer to migrate state into
it.

Re-running `apply` here later is safe (idempotent) but should rarely be
needed — this tree is meant to be applied once per AWS account.
