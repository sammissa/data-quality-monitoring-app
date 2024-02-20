import { App, Stack } from 'aws-cdk-lib';
import { Grant, Role } from 'aws-cdk-lib/aws-iam';
import { anyOfClass, anyString, instance, mock, when } from 'ts-mockito';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Glue } from '../../lib/constructs/glue';
import { Template } from 'aws-cdk-lib/assertions';

/**
 * Unit tests for the {@link Glue} class.
 */
describe('Glue', () => {
  const bucketMockClass = mock(Bucket);
  const grantMockClass = mock(Grant);

  let bucketMock: Bucket;
  let grantMock: Grant;
  let stack: Stack;
  let glueConstruct: Glue;
  let template: Template;

  beforeAll(() => {
    // Arrange
    const app = new App();
    stack = new Stack(app, 'TestStack');

    bucketMock = instance(bucketMockClass);
    grantMock = instance(grantMockClass);

    when(bucketMockClass.bucketName).thenReturn('test-input-bucket');
    when(bucketMockClass.grantRead(anyOfClass(Role), anyString())).thenReturn(grantMock);

    const glueProps = {
      accountId: stack.account,
      region: stack.region,
      stage: '',
      bucket: bucketMock,
      contentProviderPath: 'test-content-provider',
      databaseName: 'test-database'
    };

    // Act
    glueConstruct = new Glue(stack, 'TestGlue', glueProps);
    template = Template.fromStack(stack);
  });

  test('creates the right number of resources', () => {
    // Assert
    template.resourceCountIs('AWS::Glue::Crawler', 1);
    template.resourceCountIs('AWS::IAM::Policy', 1);
    template.resourceCountIs('AWS::IAM::Role', 1);
  });

  test('creates a glue crawler with the correct properties', () => {
    const expectedGlueCrawlerProps = {
      Configuration: '{"Version":1,"CrawlerOutput":{"Partitions":{"AddOrUpdateBehavior":"InheritFromTable"}}}',
      DatabaseName: 'test-database',
      Name: 'test-content-provider-GlueCrawler',
      RecrawlPolicy: {
        RecrawlBehavior: 'CRAWL_EVERYTHING'
      },
      SchemaChangePolicy: {
        DeleteBehavior: 'DELETE_FROM_DATABASE',
        UpdateBehavior: 'UPDATE_IN_DATABASE'
      },
      Targets: {
        S3Targets: [
          {
            Path: 's3://test-input-bucket/test-content-provider/'
          }
        ]
      }
    };

    // Assert
    template.hasResourceProperties('AWS::Glue::Crawler', expectedGlueCrawlerProps);
  });

  test('creates a iam role with the correct properties', () => {
    const expectedIamRoleProps = {
      AssumeRolePolicyDocument: {
        Statement: [
          {
            Action: 'sts:AssumeRole',
            Effect: 'Allow',
            Principal: {
              Service: 'glue.amazonaws.com'
            }
          }
        ],
        Version: '2012-10-17'
      },
      ManagedPolicyArns: [
        {
          'Fn::Join': [
            '',
            [
              'arn:',
              {
                Ref: 'AWS::Partition'
              },
              ':iam::aws:policy/service-role/AWSGlueServiceRole'
            ]
          ]
        }
      ]
    };

    // Assert
    template.hasResourceProperties('AWS::IAM::Role', expectedIamRoleProps);
  });
  test('creates a iam policy with the correct properties', () => {
    const expectedIamPolicyProps = {
      PolicyDocument: {
        Statement: [
          {
            Action: ['glue:*', 's3:*'],
            Effect: 'Allow',
            Resource: '*'
          }
        ],
        Version: '2012-10-17'
      }
    };

    // Assert
    template.hasResourceProperties('AWS::IAM::Policy', expectedIamPolicyProps);
  });


  test('callGlueService returns a callAwsService task with the correct task definition', () => {
    const expectedTaskProps = {
      End: true,
      Parameters: {
        Name: 'test-content-provider-GlueCrawler'
      },
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition'
            },
            ':states:::aws-sdk:glue:startCrawler'
          ]
        ]
      },
      Type: 'Task'
    };

    const callGlueServiceTask = glueConstruct.callGlueService('TestCallGlueService', 'startCrawler', 'glue:StartCrawler');

    // Assert
    expect(stack.resolve(callGlueServiceTask.toStateJson())).toEqual(expectedTaskProps);
  });
});