export enum StackName {
    DEV = 'DQMADevStack',
    PROD = 'DQMAProdStack'
}

export enum Stage {
    DEV = 'dev',
    PROD = 'prod'
}

export enum BucketNameSuffix {
    INPUT = '-s3-input-bucket',
    OUTPUT = '-s3-output-bucket',
}

export enum ContentProviderPath {
    BETA = 'beta-content-provider',
}

export const ResultPath = {
  RESULTS: '$.results',
  EXECUTION_INPUT:'$.results.executionInput',
  ATHENA_GET_QUERY_RESULTS: '$.results.athenaGetQueryResults',
  ATHENA_START_QUERY_EXECUTION: '$.results.athenaStartQueryExecution',
  LAMBDA_INVOKE: '$.results.lambdaInvoke',
  SNS_PUBLISH_TOPIC: '$.results.snsPublishTopic'
};

export const EXECUTION_INPUT_DETAIL_PATH = '$$.Execution.Input.detail';
