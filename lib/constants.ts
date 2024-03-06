export enum StackName {
    DEV = 'DQMADevStack',
    PROD = 'DQMAProdStack'
}

export enum Stage {
    DEV = 'dev',
    PROD = 'prod'
}

export enum BucketNameSuffix {
    INPUT = '-input-s3bucket',
    OUTPUT = '-output-s3bucket',
}

export enum ContentProviderPath {
    BETA = 'beta-content-provider',
}

export enum ResultPath {
  RESULTS = '$.results',
  GLUE = '$.results.glue',
  ATHENA = '$.results.athena',
  LAMBDA = '$.results.lambda',
  SNS = '$.results.sns',
  ERROR = '$.results.error'
}

export enum Error {
    INVALID_CONTENT_PROVIDER_FILE_ERROR = 'InvalidContentProviderFileError',
}
