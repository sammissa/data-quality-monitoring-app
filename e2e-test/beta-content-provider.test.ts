import { BucketNameSuffix, ContentProviderPath, Error, StackName, Stage } from '../lib/constants';
import { DescribeExecutionCommand,
  DescribeExecutionOutput,
  ExecutionListItem, ListExecutionsCommand,
  ListExecutionsCommandOutput,
  ListStateMachinesCommand,
  ListStateMachinesCommandOutput,
  ListTagsForResourceCommand,
  ListTagsForResourceCommandOutput,
  SFNClient,
  StateMachineListItem,
  Tag
} from '@aws-sdk/client-sfn';
import { GetCrawlerCommand, GetCrawlerResponse, GlueClient } from '@aws-sdk/client-glue';
import { GetObjectCommand, GetObjectCommandOutput, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { promises as fsPromises } from 'fs';

const clientConfig = { region: 'us-east-1' };
const s3Client = new S3Client(clientConfig);
const sfnClient = new SFNClient(clientConfig);
const glueClient = new GlueClient(clientConfig);

let stateMachineArn: string;

async function waitForCrawler(): Promise<void> {
  let getCrawlerCommand = new GetCrawlerCommand({ Name: 'beta-content-provider-devGlueCrawler' });
  let getCrawlerResponse: GetCrawlerResponse = await glueClient.send(getCrawlerCommand);

  while (getCrawlerResponse.Crawler!.State! !== 'READY') {
    await new Promise(resolve => setTimeout(resolve, 10000));
    getCrawlerResponse = await glueClient.send(getCrawlerCommand);
  }
}

async function uploadFileToS3(folderName: string, fileName: string): Promise<void> {
  // Define the name of the S3 bucket and the key (file path) to upload
  const bucketName = StackName.DEV.toLowerCase() + BucketNameSuffix.INPUT.toLowerCase();
  const key = `${ContentProviderPath.BETA}/${folderName}/${fileName}.csv`;

  const fileContent = await fsPromises.readFile(`./resources/test-content-provider/${fileName}.csv`, { encoding: 'utf-8' });

  // Upload the file to S3
  const putObj = new PutObjectCommand({
    Key: key,
    Bucket: bucketName,
    Body: fileContent
  });
  await s3Client.send(putObj);
}

async function findDevStateMachine(): Promise<StateMachineListItem | undefined> {
  const allSFNs: StateMachineListItem[] = [];

  let listStateMachinesCommand = new ListStateMachinesCommand({});
  let listStateMachinesCommandOutput: ListStateMachinesCommandOutput = await sfnClient.send(listStateMachinesCommand);
  allSFNs.push(...(listStateMachinesCommandOutput.stateMachines ?? []));

  while (listStateMachinesCommandOutput.nextToken) {
    listStateMachinesCommand = new ListStateMachinesCommand({ nextToken: listStateMachinesCommandOutput.nextToken });
    listStateMachinesCommandOutput = await sfnClient.send(listStateMachinesCommand);
    allSFNs.push(...(listStateMachinesCommandOutput.stateMachines ?? []));
  }

  for (const sfn of allSFNs) {
    const listTagsCommand = new ListTagsForResourceCommand({ resourceArn: sfn.stateMachineArn });
    const listTagsCommandOutput: ListTagsForResourceCommandOutput = await sfnClient.send(listTagsCommand);
    const tags: Tag[] = listTagsCommandOutput.tags ?? [];

    const desiredTag = tags.find(tag => tag.key === 'stage' && tag.value === Stage.DEV);

    if (desiredTag) {
      return sfn;
    }
  }

  return undefined;
}

async function findRunningStateMachineExecution(stateMachineArn: string): Promise<ExecutionListItem | undefined> {
  let targetExecution: ExecutionListItem | undefined;

  await new Promise(resolve => setTimeout(resolve, 10000));
  let listExecutionsCommand = new ListExecutionsCommand({
    stateMachineArn: stateMachineArn,
    statusFilter: 'RUNNING'
  });

  let listExecutionsCommandOutput: ListExecutionsCommandOutput = await sfnClient.send(listExecutionsCommand);
  let executions: ExecutionListItem[] = listExecutionsCommandOutput.executions ?? [];

  if (executions.length > 0) {
    targetExecution = executions[0];
  }

  return targetExecution;
}

async function describeExecution(executionArn: string): Promise<DescribeExecutionOutput> {
  const describeExecutionCommand = new DescribeExecutionCommand({ executionArn: executionArn });
  let describeExecutionOutput: DescribeExecutionOutput = await sfnClient.send(describeExecutionCommand);

  while (describeExecutionOutput.status === 'RUNNING') {
    await new Promise(resolve => setTimeout(resolve, 30000));
    describeExecutionOutput = await sfnClient.send(describeExecutionCommand);
  }
  return describeExecutionOutput;
}

async function getObjectFromS3(fileName: string): Promise<string> {
  const getObjectCommand = new GetObjectCommand({
    Bucket: StackName.DEV.toLowerCase() + BucketNameSuffix.OUTPUT.toLowerCase(),
    Key: `beta-content-provider/${fileName}`
  });
  const getObjectOutput: GetObjectCommandOutput = await s3Client.send(getObjectCommand);
  const fileContentBody = getObjectOutput.Body;
  if  (fileContentBody === undefined) {
    return `file content body is undefined for file: ${fileName}`;
  }
  const fileContentToString = await fileContentBody.transformToString();
  if (fileContentToString === undefined) {
    return `file content string is undefined for file: ${fileName}`;
  }
  return fileContentToString;
}

// TODO - Add more e2e tests to test fringe cases, i.e. multiple file upload/invalid format/empty query results etc
describe('End-to-End Tests', () => {
  beforeAll(async () => {
    const devStateMachine = await findDevStateMachine();
    expect(devStateMachine).toBeDefined();
    expect(devStateMachine?.stateMachineArn).toBeDefined();
    stateMachineArn = devStateMachine!.stateMachineArn!;
  });

  beforeEach(async () => {
    await waitForCrawler();
  }, 100000);

  test('Test state machine success path', async () => {
    await uploadFileToS3('success-path', 'valid-file');

    // upload triggers state machine execution
    const runningStateMachineExecution = await findRunningStateMachineExecution(stateMachineArn);
    expect(runningStateMachineExecution).toBeDefined();
    expect(runningStateMachineExecution?.executionArn).toBeDefined();
    const executionArn = runningStateMachineExecution!.executionArn!;

    // get execution for executionArn
    const execution = await describeExecution(executionArn);
    expect(execution).toBeDefined();

    // execution status is correct
    expect(execution?.status).toEqual('SUCCEEDED');

    // execution input is correct
    expect(execution?.input).toBeDefined();
    const executionInput = execution!.input!;
    const { source, 'detail-type': detailType, detail: { bucket: { name }, object: { key } }  } = JSON.parse(executionInput);
    expect(source).toEqual('aws.s3');
    expect(detailType).toEqual('Object Created');
    const bucketName = StackName.DEV.toLowerCase() + BucketNameSuffix.INPUT.toLowerCase();
    expect(name).toEqual(bucketName);
    expect(key).toEqual('beta-content-provider/success-path/valid-file.csv');

    // execution output is correct
    expect(execution?.output).toBeDefined();
    const executionOutput = execution!.output!;
    const { glue, athena, lambda, sns } = JSON.parse(executionOutput);

    // glue output is correct
    expect(glue).toBeDefined();
    const { Crawler: { Classifiers, Name, DatabaseName, Targets: { S3Targets: [{ Path }] } } } = glue;
    expect(Classifiers).toContain('beta-content-provider-devGlueClassifier');
    expect(Name).toEqual('beta-content-provider-devGlueCrawler');
    expect(DatabaseName).toEqual('dqmadevstack_glue_database');
    expect(Path).toEqual(`s3://${bucketName}/beta-content-provider/`);

    // athena output is correct
    expect(athena).toBeDefined();
    const { executionParameters, startQueryExecution: { outputLocation, queryExecutionId }, getQueryResults } = athena;
    expect(executionParameters).toEqual(['success-path']);
    expect(outputLocation).toBeDefined();
    const athenaOutput = await getObjectFromS3(outputLocation.split('/')[4]);
    const expectedOutput = '"total_keywords","keywords_with_valid_qa_pairs","keywords_with_invalid_qa_pairs","pass_percentage","success"\n"100","100","0","1.0","true"\n';
    expect(athenaOutput).toContain(expectedOutput);
    expect(queryExecutionId).toBeDefined();
    expect(getQueryResults).toBeDefined();

    // lambda output is correct
    expect(lambda).toBeDefined();
    const { results: { total_keywords, keywords_with_valid_qa_pairs, keywords_with_invalid_qa_pairs, pass_percentage, success } } = lambda;
    expect(total_keywords).toEqual(100);
    expect(keywords_with_valid_qa_pairs).toEqual(100);
    expect(keywords_with_invalid_qa_pairs).toEqual(0);
    expect(pass_percentage).toEqual(1);
    expect(success).toEqual(true);

    // sns output is correct
    expect(sns).toBeDefined();
    const { subject, statusCode } = sns;
    expect(subject).toEqual('Data quality monitoring job for beta-content-provider succeeded.');
    expect(statusCode).toEqual(200);
  }, 300000);

  test('Test state machine fail path', async () => {
    await uploadFileToS3('fail-path', 'invalid-file');

    // upload triggers state machine execution
    const runningStateMachineExecution = await findRunningStateMachineExecution(stateMachineArn);
    expect(runningStateMachineExecution).toBeDefined();
    expect(runningStateMachineExecution?.executionArn).toBeDefined();
    const executionArn = runningStateMachineExecution!.executionArn!;

    // get execution for executionArn
    const execution = await describeExecution(executionArn);
    expect(execution).toBeDefined();

    // execution status is correct
    expect(execution?.status).toEqual('FAILED');

    // execution input is correct
    expect(execution?.input).toBeDefined();
    const executionInput = execution!.input!;
    const { source, 'detail-type': detailType, detail: { bucket: { name }, object: { key } }  } = JSON.parse(executionInput);
    expect(source).toEqual('aws.s3');
    expect(detailType).toEqual('Object Created');
    const bucketName = StackName.DEV.toLowerCase() + BucketNameSuffix.INPUT.toLowerCase();
    expect(name).toEqual(bucketName);
    expect(key).toEqual('beta-content-provider/fail-path/invalid-file.csv');

    // execution error is correct
    expect(execution?.error).toBeDefined();
    const executionError = execution!.error!;
    expect(executionError).toEqual(Error.INVALID_CONTENT_PROVIDER_FILE_ERROR);

    // execution cause is correct
    expect(execution?.cause).toBeDefined();
    const executionCause = execution!.cause!;
    const { glue, athena, lambda, sns, error } = JSON.parse(executionCause);

    // glue output is correct
    expect(glue).toBeDefined();
    const { Crawler: { Classifiers, Name, DatabaseName, Targets: { S3Targets: [{ Path }] } } } = glue;
    expect(Classifiers).toContain('beta-content-provider-devGlueClassifier');
    expect(Name).toEqual('beta-content-provider-devGlueCrawler');
    expect(DatabaseName).toEqual('dqmadevstack_glue_database');
    expect(Path).toEqual(`s3://${bucketName}/beta-content-provider/`);

    // athena output is correct
    expect(athena).toBeDefined();
    const { executionParameters, startQueryExecution: { outputLocation, queryExecutionId }, getQueryResults } = athena;
    expect(executionParameters).toEqual(['fail-path']);
    expect(outputLocation).toBeDefined();
    const athenaOutput = await getObjectFromS3(outputLocation.split('/')[4]);
    const expectedOutput = '"total_keywords","keywords_with_valid_qa_pairs","keywords_with_invalid_qa_pairs","pass_percentage","success"\n"100","82","18","0.82","false"\n';
    expect(athenaOutput).toContain(expectedOutput);
    expect(queryExecutionId).toBeDefined();
    expect(getQueryResults).toBeDefined();

    // lambda output is correct
    expect(lambda).toBeDefined();
    const { results: { total_keywords, keywords_with_valid_qa_pairs, keywords_with_invalid_qa_pairs, pass_percentage, success } } = lambda;
    expect(total_keywords).toEqual(100);
    expect(keywords_with_valid_qa_pairs).toEqual(82);
    expect(keywords_with_invalid_qa_pairs).toEqual(18);
    expect(pass_percentage).toEqual(0.82);
    expect(success).toEqual(false);

    // sns output is correct
    expect(sns).toBeDefined();
    const { subject, statusCode } = sns;
    expect(subject).toEqual('Data quality monitoring job for beta-content-provider failed.');
    expect(statusCode).toEqual(200);

    // error output is correct
    expect(error).toBeDefined();
    const { errorType, errorMessage } = error;
    expect(errorType).toEqual(Error.INVALID_CONTENT_PROVIDER_FILE_ERROR);
    expect(errorMessage).toEqual('Ingested content provider file failed query validation.');
  }, 300000);
});



