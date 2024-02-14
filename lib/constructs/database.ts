import { CfnDatabase } from 'aws-cdk-lib/aws-glue';
import { Construct } from 'constructs';

/**
 * Properties for Database construct.
 * @param accountId - Aws Account ID of the stack.
 * @param databaseName - Name of the Glue Database
 */
export interface DatabaseProps {
  readonly accountId: string;
  readonly databaseName: string;
}

/**
 * Creates a Glue Database for executing Athena queries.
 * @property databaseName - Name of the Glue Database
 */
export class Database extends Construct {
  public readonly databaseName: string;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    this.databaseName = props.databaseName;

    new CfnDatabase(this, id, {
      catalogId: props.accountId,
      databaseInput: {
        name: this.databaseName,
        description: 'Glue Database for executing Athena queries',
        createTableDefaultPermissions: [
          {
            principal: {
              dataLakePrincipalIdentifier: 'IAM_ALLOWED_PRINCIPALS'
            },
            permissions: [ 'ALL' ]
          }
        ]
      }
    });
  }
}
