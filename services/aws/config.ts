export const awsConfig = {
  apiUrl:
    process.env.NEXT_PUBLIC_TRIPCHECK_API_URL ||
    'https://mnyheiadjf.execute-api.ap-northeast-1.amazonaws.com',
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'ap-northeast-1',
  userPoolId:
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ||
    'ap-northeast-1_y0S4oRa5x',
  userPoolClientId:
    process.env.NEXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID ||
    '6bjh91hmqbsu7bcjfjk44b8v21',
};
