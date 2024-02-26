export enum StackName {
    DEV = 'DQMADevStack',
    PROD = 'DQMAProdStack'
}

export enum Stage {
    DEV = 'dev',
    PROD = 'prod'
}

export enum BucketNameSuffix {
    INPUT = '-input-bucket',
    OUTPUT = '-output-bucket',
}

export enum ContentProviderPath {
    BETA = 'beta-content-provider',
}

export const ResultPath = {
  RESULTS: '$.results',
  GLUE: '$.results.glue',
  ATHENA: '$.results.athena',
  LAMBDA: '$.results.lambda',
  SNS: '$.results.sns'
};
