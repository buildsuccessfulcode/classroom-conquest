import { cookies } from "next/headers";
import { TEACHER_COOKIE, isValidTeacherToken } from "@/lib/teacher-auth";
import TeacherDashboard from "./TeacherDashboard";
import TeacherLogin from "./TeacherLogin";

export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  const store = await cookies();
  const token = store.get(TEACHER_COOKIE)?.value;
  if (!isValidTeacherToken(token)) {
    return <TeacherLogin />;
  }
  return <TeacherDashboard />;
}
