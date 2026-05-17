import { Configuration, Value } from "heming-bun-boot";

@Configuration()
export class AppConfig {
  @Value("PORT", 3002)
  port!: number;

  @Value("DB_HOST", "localhost")
  dbHost!: string;

  @Value("DB_PORT", 3306)
  dbPort!: number;
}
