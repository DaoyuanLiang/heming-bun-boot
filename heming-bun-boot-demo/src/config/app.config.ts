import { Configuration, Value } from "heming-bun-boot";

@Configuration()
export class AppConfig {
  @Value("PORT", 3000)
  port!: number;

  @Value("JWT_SECRET", "demo-secret-change-me")
  jwtSecret!: string;

  @Value("JWT_EXPIRES_IN", "2h")
  jwtExpiresIn!: string;
}
