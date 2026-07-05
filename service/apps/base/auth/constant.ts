export type TAuthError =
    | 'invalid-credentials'
    | 'user-not-found'
    | 'email-already-in-use'
    | 'weak-password';

export type TAuthSuccess = 'login-success' | 'signup-success';

export type TAuthResult = TAuthError | TAuthSuccess;

export type TAuthUserRole =
    | 'super_admin'
    | 'owner'
    | 'admin'
    | 'staff'
    | 'member'
    | 'user';
