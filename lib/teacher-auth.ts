import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const TEACHER_COOKIE = "cc_teacher_session";
export const TEACHER_SESSION_MAX_AGE = 60 * 60 * 12;

const SESSION_SALT = "classroom-conquest-teacher-v1";
const PASSWORD_HASH =
  process.env.TEACHER_PASSWORD_HASH ??
  "8d4baef7f6017ec8b81ef3141b4027776a705c41f6359e59083f09e4c58df677";

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function teacherSessionToken(): string {
  return hash(`${PASSWORD_HASH}:${SESSION_SALT}`);
}

export function verifyTeacherPassword(password: string): boolean {
  if (!password) return false;
  return safeEqual(hash(password), PASSWORD_HASH);
}

export function isValidTeacherToken(token: string | undefined): boolean {
  if (!token) return false;
  return safeEqual(token, teacherSessionToken());
}

export async function requireTeacher(): Promise<void> {
  const store = await cookies();
  if (!isValidTeacherToken(store.get(TEACHER_COOKIE)?.value)) {
    throw new Error("Akses guru diperlukan");
  }
}
