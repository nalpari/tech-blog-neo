import { cookies } from "next/headers";
import { get } from "./api";

/** 브라우저의 세션 쿠키를 API 로 넘겨서 조회한다 (draft·liked·내 정보). */
export async function getAuthed<T>(path: string) {
  const cookie = (await cookies()).toString();
  return get<T>(path, { headers: { cookie } });
}
