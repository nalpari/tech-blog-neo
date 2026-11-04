// "읽던 글" 위치. API 에 없는 기능이라 브라우저 localStorage 에만 둔다.
export type Resume = { slug: string; title: string; progress: number; section: number };
const KEY = "ff-resume";

export const readResume = (): Resume | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
};
export const writeResume = (r: Resume | null) => (r ? localStorage.setItem(KEY, JSON.stringify(r)) : localStorage.removeItem(KEY));
