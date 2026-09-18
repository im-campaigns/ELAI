// 필수 환경변수가 설정되지 않아 기능을 사용할 수 없을 때 던지는 에러.
// API 라우트에서 이 에러를 잡아 사용자에게 "네트워크 오류" 대신 명확한 안내 메시지를 보여준다.
export class ConfigError extends Error {}
