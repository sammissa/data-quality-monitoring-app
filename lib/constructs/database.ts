import { CfnDatabase } from 'aws-cdk-lib/aws-glue';
import { Construct } from 'constructs';

/**
 * Properties for Database construct.
 *
 * @param {string} accountId - AWS Account ID of the stack
 * @param {string} stackPrefix - Stage prefix added to created database
 */
export interface DatabaseProps {
  readonly accountId: string;
  readonly stackPrefix: string;
}

/**
 * Construct to create an AWS Glue Database for executing Athena queries.
 *
 * @param {Construct} scope - Scope in which this construct is defined
 * @param {string} id - ID of the construct
 * @param {DatabaseProps} props - Properties of the construct
 */
export class Database extends Construct {
  public readonly databaseName: string;

  constructor(scope: Construct, id: string, props: DatabaseProps) {
    super(scope, id);

    this.databaseName = `${props.stackPrefix}_glue_database`;

    // Create the database
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
