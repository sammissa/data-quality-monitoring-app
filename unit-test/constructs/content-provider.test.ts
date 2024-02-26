import { App, Stack } from 'aws-cdk-lib';
import { Capture, Template } from 'aws-cdk-lib/assertions';
import { Grant, Role } from 'aws-cdk-lib/aws-iam';
import { anyOfClass, anyString, instance, mock, when } from 'ts-mockito';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { ContentProvider } from '../../lib/constructs/content-provider';
import { Database } from '../../lib/constructs/database';
import { S3 } from '../../lib/constructs/s3';

/**
 * Unit tests for the {@link ContentProvider} class.
 */
describe('ContentProvider', () => {
  const s3MockClass = mock(S3);
  const databaseMockClass = mock(Database);

  let stack: Stack;
  let contentProviderConstruct: ContentProvider;
  let template: Template;

  beforeAll(() => {
    // Arrange
    const app = new App();
    stack = new Stack(app, 'TestStack');

    const inputBucketMockClass = mock(Bucket);
    const inputBucketMock = instance(inputBucketMockClass);

    const outputBucketMockClass = mock(Bucket);
    const outputBucketMock = instance(outputBucketMockClass);

    const grantMockClass = mock(Grant);
    const grantMock = instance(grantMockClass);

    const s3Mock = instance(s3MockClass);
    when(inputBucketMockClass.bucketName).thenReturn('test-input-bucket');
    when(s3MockClass.inputBucket).thenReturn(inputBucketMock);
    when(inputBucketMockClass.grantRead(anyOfClass(Role), anyString())).thenReturn(grantMock);
    when(outputBucketMockClass.bucketName).thenReturn('test-output-bucket');
    when(s3MockClass.outputBucket).thenReturn(outputBucketMock);

    const databaseMock = instance(databaseMockClass);
    when(databaseMockClass.databaseName).thenReturn('test_database');

    const contentProviderProps = {
      accountId: stack.account,
      region: stack.region,
      stage: '',
      s3Construct: s3Mock,
      contentProviderPath: 'test-content-provider',
      databaseConstruct: databaseMock
    };

    // Act
    contentProviderConstruct = new ContentProvider(stack, 'TestContentProvider', contentProviderProps);
    template = Template.fromStack(stack);
  });

  test('creates the right number of resources', () => {
    // Assert
    template.resourceCountIs('AWS::IAM::Role', 4);
    template.resourceCountIs('AWS::IAM::Policy', 3);
    template.resourceCountIs('AWS::Glue::Classifier', 1);
    template.resourceCountIs('AWS::Glue::Crawler', 1);
    template.resourceCountIs('AWS::Athena::WorkGroup', 1);
    template.resourceCountIs('AWS::Logs::LogGroup', 1);
    template.resourceCountIs('AWS::Lambda::Function', 1);
    template.resourceCountIs('AWS::SNS::Topic', 2);
    template.resourceCountIs('AWS::SNS::Subscription', 2);
    template.resourceCountIs('AWS::StepFunctions::StateMachine', 1);
    template.resourceCountIs('AWS::Events::Rule', 1);
  });

  test('creates a step function with the task chain', () => {
    // Assert
    const definitionString = new Capture();
    template.hasResourceProperties('AWS::StepFunctions::StateMachine', {
      DefinitionString: definitionString
    });

    const definitionJsonString = JSON.stringify(definitionString.asObject());
    expect(definitionJsonString).toMatch(/"StartAt\\":\\"Start Glue Crawler\\"/);
    expect(definitionJsonString).toMatch(/"Next\\":\\"Get Glue Crawler\\"/);
    expect(definitionJsonString).toMatch(/"Next\\":\\"Check Glue Crawler\\"/);
    expect(definitionJsonString).toMatch(/"Next\\":\\"Wait for Glue Crawler\\"/);

    expect(definitionJsonString).toMatch(/"Default\\":\\"Get Execution Parameters\\"/);
    expect(definitionJsonString).toMatch(/"Next\\":\\"Start Query Execution\\"/);
    expect(definitionJsonString).toMatch(/"Next\\":\\"Get Query Results\\"/);
    expect(definitionJsonString).toMatch(/"Next\\":\\"Process Query Results\\"/);
    expect(definitionJsonString).toMatch(/"Next\\":\\"Check Query Results\\"/);

    expect(definitionJsonString).toMatch(/"Next\\":\\"Publish Success Topic\\"/);
    expect(definitionJsonString).toMatch(/"Next\\":\\"Success\\"/);

    expect(definitionJsonString).toMatch(/"Default\\":\\"Publish Fail Topic\\"/);
    expect(definitionJsonString).toMatch(/"Next\\":\\"Fail\\"/);
  });
});