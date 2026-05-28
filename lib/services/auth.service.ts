import { AuthRepository, type LoginResult, type SignupResult } from '@/lib/repositories/auth.repo';
import type { LoginInput, SignupInput } from '@/lib/validations/auth.schema';

export class AuthService {
    private static instance: AuthService;
    private readonly authRepo: AuthRepository;

    private constructor() {
        this.authRepo = AuthRepository.getInstance();
    }

    static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    async login(input: LoginInput): Promise<LoginResult> {
        return await this.authRepo.signIn(input);
    }

    async register(input: SignupInput): Promise<SignupResult> {
        return await this.authRepo.signUp(input);
    }
}
