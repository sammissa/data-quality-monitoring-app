import { App, Stack } from 'aws-cdk-lib';
import { ResultPath } from '../../lib/constants';
import { SNS } from '../../lib/constructs/sns';
import { Template } from 'aws-cdk-lib/assertions';

/**
 * Unit tests for the {@link SNS} class.
 */
describe('SNS', () => {
  let stack: Stack;
  let snsConstruct: SNS;
  let template: Template;

  beforeAll(() => {
    // Arrange
    const app = new App();
    stack = new Stack(app, 'TestStack');

    const snsProps = {
      contentProviderPath: 'test-content-provider',
      stage: ''
    };

    // Act
    snsConstruct = new SNS(stack, 'TestSNS', snsProps);
    template = Template.fromStack(stack);
  });

  test('creates the right number of resources', () => {
    // Assert
    template.resourceCountIs('AWS::SNS::Topic', 2);
    template.resourceCountIs('AWS::SNS::Subscription', 2);
  });

  test('creates sns topics with the correct properties', () => {
    // Assert
    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'test-content-provider-FailTopic'
    });
    template.hasResourceProperties('AWS::SNS::Topic', {
      TopicName: 'test-content-provider-SuccessTopic'
    });
  });

  test('creates sns subscriptions with the correct properties', () => {
    // Assert
    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'testfail@email.co.uk'
    });
    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'testsuccess@email.co.uk'
    });
  });

  test('publishSuccessTopic returns a sns publish task with the correct task definition', () => {
    const subject = 'Data quality monitoring job for test-content-provider succeeded.';
    const expectedTaskProps = {
      End: true,
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition'
            },
            ':states:::sns:publish'
          ]
        ]
      },
      OutputPath: ResultPath.RESULTS,
      ResultPath: ResultPath.SNS,
      ResultSelector: {
        'statusCode.$': '$.SdkHttpMetadata.HttpStatusCode',
        subject: subject
      },
      Parameters: {
        TopicArn: {
          Ref: 'TestSNSSuccessTopic60B837CE'
        },
        'Message.$': 'States.Format(\'Test message: {}\', $.results.lambda.results.keyword)',
        Subject: subject
      }
    };

    const publishSuccessTopic = snsConstruct.publishSuccessTopic('TestPublishSuccessTopic');
    // Assert
    expect(stack.resolve(publishSuccessTopic.toStateJson())).toEqual(expectedTaskProps);
  });

  test('publishFailTopic returns a sns publish task with the correct task definition', () => {
    const subject = 'Data quality monitoring job for test-content-provider failed.';
    const expectedTaskProps = {
      End: true,
      Type: 'Task',
      Resource: {
        'Fn::Join': [
          '',
          [
            'arn:',
            {
              Ref: 'AWS::Partition'
            },
            ':states:::sns:publish'
          ]
        ]
      },
      OutputPath: ResultPath.RESULTS,
      ResultPath: ResultPath.SNS,
      ResultSelector: {
        'statusCode.$': '$.SdkHttpMetadata.HttpStatusCode',
        subject: subject
      },
      Parameters: {
        TopicArn: {
          Ref: 'TestSNSFailTopic2F91633A'
        },
        'Message.$': 'States.Format(\'Test message: {}\', $.results.lambda.results.keyword)',
        Subject: subject
      }
    };

    const publishFailTopicTask = snsConstruct.publishFailTopic('TestPublishFailTopic');
    // Assert
    expect(stack.resolve(publishFailTopicTask.toStateJson())).toEqual(expectedTaskProps);
  });
});
