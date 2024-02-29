import { AthenaGetQueryResults, AthenaStartQueryExecution } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { IntegrationPattern, JsonPath, Pass } from 'aws-cdk-lib/aws-stepfunctions';
import { CfnWorkGroup } from 'aws-cdk-lib/aws-athena';
import { Construct } from 'constructs';
import { ResultPath } from '../constants';
import { readFileSync } from 'fs';

/**
 * Properties for Athena construct.
 *
 * @param {string} bucketName - Output s3 bucket name to store Athena query results
 * @param {string} contentProviderPath - Path to the content provider data files
 * @param {string} databaseName - Name of the Athena database
 * @param {string} stage - Stage of the stack
 */
export interface AthenaProps {
  readonly bucketName: string;
  readonly contentProviderPath: string;
  readonly databaseName: string;
  readonly stage: string;
}

/**
 * Construct to create an AWS Workgroup for executing Athena queries.
 *
 * @param {Construct} scope - Scope in which this construct is defined
 * @param {string} id - ID of the construct
 * @param {DatabaseProps} props - Properties of the construct
 */
export class Athena extends Construct {
  private readonly workgroupName: string;
  private readonly databaseName: string;
  private readonly queryString: string;

  constructor(scope: Construct, id: string, props: AthenaProps) {
    super(scope, id);

    this.workgroupName = `${props.contentProviderPath}-${props.stage}AthenaWorkgroup`;
    this.databaseName = props.databaseName;

    const tableName = props.contentProviderPath.replace(
      new RegExp(/-/, 'g'),
      '_'
    );

    // TODO Implement a better way to construct athena query strings
    this.queryString = readFileSync(`./resources/${props.contentProviderPath}/athena-query.sql`, 'utf-8')
      .replace('${DATABASE}', props.databaseName)
      .replace('${TABLE}', tableName);

    new CfnWorkGroup(this, 'Workgroup', {
      name: this.workgroupName,
      recursiveDeleteOption: true,
      state: 'ENABLED',
      workGroupConfiguration: {
        enforceWorkGroupConfiguration: true,
        resultConfiguration: {
          outputLocation: `s3://${props.bucketName}/${props.contentProviderPath}/`
        }
      }
    });
  }

  /**
   * Get the execution parameters for the Athena query.
   *
   * @param {string} id - Logical ID for the pass
   * @returns {Pass}
   */
  public getExecutionParameters(id: string): Pass {
    return new Pass(this, id, {
      parameters: {
        'executionParameters': JsonPath.array(JsonPath.arrayGetItem(JsonPath.stringSplit(JsonPath.stringAt('$$.Execution.Input.detail.object.key'), '/'), 1))
      },
      resultPath: ResultPath.ATHENA
    });
  }

  /**
   * Start the Athena query execution.
   *
   * @param {string} id - Logical ID for the task
   * @returns {AthenaStartQueryExecution}
   */
  public startQueryExecution(id: string): AthenaStartQueryExecution {
    return new AthenaStartQueryExecution(this, id, {
      integrationPattern: IntegrationPattern.RUN_JOB,
      queryString: this.queryString,
      queryExecutionContext: {
        databaseName: this.databaseName
      },
      executionParameters: JsonPath.listAt(`${ResultPath.ATHENA}.executionParameters`),
      workGroup: this.workgroupName,
      resultSelector: {
        'queryExecutionId.$': '$.QueryExecution.QueryExecutionId',
        'outputLocation.$': '$.QueryExecution.ResultConfiguration.OutputLocation'
      },
      resultPath: `${ResultPath.ATHENA}.startQueryExecution`
    });
  }

  /**
   * Get the query results for the Athena query.
   *
   * @param {string} id - Logical ID for the task
   * @returns {AthenaGetQueryResults}
   */
  public getQueryResults(id: string): AthenaGetQueryResults {
    return new AthenaGetQueryResults(this, id, {
      queryExecutionId: JsonPath.stringAt(`${ResultPath.ATHENA}.startQueryExecution.queryExecutionId`),
      resultSelector: {
        'resultSet.$': '$.ResultSet'
      },
      resultPath: `${ResultPath.ATHENA}.getQueryResults`
    });
  }
}
