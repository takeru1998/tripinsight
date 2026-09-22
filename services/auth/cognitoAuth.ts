import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserAttribute,
  CognitoUserPool,
  type CognitoUserSession,
  type ISignUpResult,
} from 'amazon-cognito-identity-js';

import { awsConfig } from '@/services/aws/config';

const userPool = new CognitoUserPool({
  UserPoolId: awsConfig.userPoolId,
  ClientId: awsConfig.userPoolClientId,
});

export function signUp(email: string, password: string) {
  return new Promise<ISignUpResult>((resolve, reject) => {
    userPool.signUp(
      email,
      password,
      [new CognitoUserAttribute({ Name: 'email', Value: email })],
      [],
      (error, result) => {
        if (error || !result) reject(error || new Error('ユーザー登録に失敗しました'));
        else resolve(result);
      },
    );
  });
}

export function confirmSignUp(email: string, code: string) {
  const user = new CognitoUser({ Username: email, Pool: userPool });
  return new Promise<void>((resolve, reject) => {
    user.confirmRegistration(code, true, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export function signIn(email: string, password: string) {
  const user = new CognitoUser({ Username: email, Pool: userPool });
  const details = new AuthenticationDetails({ Username: email, Password: password });
  return new Promise<CognitoUserSession>((resolve, reject) => {
    user.authenticateUser(details, {
      onSuccess: resolve,
      onFailure: reject,
      newPasswordRequired: () => reject(new Error('新しいパスワードの設定が必要です')),
    });
  });
}

export function signOut() {
  userPool.getCurrentUser()?.signOut();
}

export function getCurrentSession() {
  const user = userPool.getCurrentUser();
  if (!user) return Promise.resolve<CognitoUserSession | null>(null);
  return new Promise<CognitoUserSession | null>((resolve) => {
    user.getSession((error: Error | null, session: CognitoUserSession | null) => {
      resolve(error || !session?.isValid() ? null : session);
    });
  });
}

export async function getAccessToken() {
  const session = await getCurrentSession();
  return session?.getAccessToken().getJwtToken() ?? null;
}

export async function getCurrentUserEmail() {
  const session = await getCurrentSession();
  return session?.getIdToken().payload.email as string | undefined;
}
