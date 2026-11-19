import { cookies } from "next/headers";
import { listQuestionGroups, listSessions } from "@/app/actions";
import { isSupabaseConfigured } from "@/lib/config";
import { TEACHER_COOKIE, isValidTeacherToken } from "@/lib/teacher-auth";
import type { QuestionGroupSummary, Session } from "@/lib/types";
import TeacherDashboard from "./TeacherDashboard";
import TeacherLogin from "./TeacherLogin";

export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  const store = await cookies();
  const token = store.get(TEACHER_COOKIE)?.value;
  if (!isValidTeacherToken(token)) {
    return <TeacherLogin />;
  }

  let initialSessions: Session[] | null = null;
  let initialGroups: QuestionGroupSummary[] | null = null;
  if (isSupabaseConfigured()) {
    try {
      [initialSessions, initialGroups] = await Promise.all([
        listSessions(),
        listQuestionGroups(),
      ]);
    } catch {
      initialSessions = null;
      initialGroups = null;
    }
  }

  return (
    <TeacherDashboard
      initialSessions={initialSessions}
      initialGroups={initialGroups}
    />
  );
}
