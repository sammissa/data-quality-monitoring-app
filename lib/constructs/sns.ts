import { JsonPath, TaskInput } from 'aws-cdk-lib/aws-stepfunctions';
import { Subscription, SubscriptionProtocol, Topic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { ResultPath } from '../constants';
import { SnsPublish } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { readFileSync } from 'fs';

/**
 * Properties for SNS construct.
 *
 * @param {string} contentProviderPath - Path to the content provider data files
 * @param {string} stage - Stage of the stack
 */
export interface SNSProps {
  readonly contentProviderPath: string;
  readonly stage: string;
}

/**
 * Construct to create AWS SNS topics, subscriptions, and related resources.
 *
 * @param {Construct} scope - Scope in which this construct is defined
 * @param {string} id - ID of the construct
 * @param {LambdaProps} props - Properties of the construct
 */
export class SNS extends Construct {
  private readonly contentProviderPath: string;
  private readonly successSNSTopic: Topic;
  private readonly failSNSTopic: Topic;
  private readonly message: string;

  constructor(scope: Construct, id: string, props: SNSProps) {
    super(scope, id);

    this.contentProviderPath = props.contentProviderPath;

    // TODO Implement a better way to construct sns messages
    const snsConfig = JSON.parse(readFileSync(`./resources/${this.contentProviderPath}/sns-config.json`, 'utf-8'));
    const { Message, Fields, FailTopicSubscriptions, SuccessTopicSubscriptions } = snsConfig;
    const processedFields = Fields.map((field: string) => JsonPath.stringAt(`${ResultPath.LAMBDA}.results.${field}`));
    this.message = JsonPath.format(Message, ...processedFields);

    this.successSNSTopic = this.createTopic('SuccessTopic', props.stage);
    SuccessTopicSubscriptions.map((email: string, index: number) =>
      this.addSubscription(`SuccessTopicSubscription-${index}`, this.successSNSTopic, email)
    );

    this.failSNSTopic = this.createTopic('FailTopic', props.stage);
    FailTopicSubscriptions.map((email: string, index: number) =>
      this.addSubscription(`FailTopicSubscription-${index}`, this.failSNSTopic, email)
    );
  }

  /**
   * returns a SnsPublish task to publish a message to the SNS Success topic.
   *
   * @param {string} id - Logical ID for the task
   * @returns {SnsPublish}
   */
  public publishSuccessTopic(id: string): SnsPublish {
    return this.publishTopic(id, this.successSNSTopic, 'succeeded');
  }

  /**
   * returns a SnsPublish task to publish a message to the SNS Fail topic.
   *
   * @param {string} id - Logical ID for the task
   * @returns {SnsPublish}
   */
  public publishFailTopic(id: string): SnsPublish {
    return this.publishTopic(id, this.failSNSTopic, 'failed');
  }

  private publishTopic(id: string, topic: Topic, result: string): SnsPublish {
    const subject = `Data quality monitoring job for ${this.contentProviderPath} ${result}.`;

    return new SnsPublish(this, id, {
      topic: topic,
      subject: subject,
      message: TaskInput.fromText(this.message),
      resultSelector: {
        'statusCode.$': '$.SdkHttpMetadata.HttpStatusCode',
        subject: subject
      },
      resultPath: ResultPath.SNS
    });
  }

  private addSubscription(id: string, topic: Topic, email: string) {
    new Subscription(this, id, {
      endpoint: email,
      protocol: SubscriptionProtocol.EMAIL,
      topic: topic
    });
  }

  private createTopic(id: string, stage: string): Topic {
    return new Topic(this, id, {
      topicName: `${this.contentProviderPath}-${stage}${id}`
    });
  }
}