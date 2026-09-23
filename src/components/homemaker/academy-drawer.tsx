import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GraduationCap, PlayCircle } from "lucide-react";
import { useState } from "react";

import { Sheet, SoftCard } from "@/components/homemaker/kolay-parts";
import { listAcademyLessons } from "@/lib/kolay-v8.functions";

/** 1 Dakika Akademi: kısa, adım adım anlatılan dersler. */
export function AcademyDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const load = useServerFn(listAcademyLessons);
  const lessonsQuery = useQuery({
    queryKey: ["kolay-academy"],
    queryFn: () => load({}),
    enabled: open,
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  const lessons = lessonsQuery.data ?? [];

  return (
    <Sheet open={open} title="1 Dakika Akademi" onClose={onClose}>
      {lessonsQuery.isPending ? (
        <p className="py-8 text-center text-sm text-hm-ink-soft">Dersler yükleniyor…</p>
      ) : lessons.length === 0 ? (
        <p className="py-8 text-center text-sm text-hm-ink-soft">Henüz ders eklenmedi.</p>
      ) : (
        <div className="grid gap-3">
          {lessons.map((lesson) => {
            const openLesson = activeId === lesson.id;
            return (
              <SoftCard key={lesson.id} className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setActiveId(openLesson ? null : lesson.id)}
                  className="flex items-start gap-3 text-left"
                >
                  <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-hm-rose-soft text-hm-rose">
                    {lesson.thumbnailUrl ? (
                      <img src={lesson.thumbnailUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <GraduationCap className="size-6" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{lesson.title}</span>
                    <span className="mt-0.5 block text-xs text-hm-ink-soft">
                      {lesson.description}
                    </span>
                    <span className="mt-1 block text-[11px] font-semibold text-hm-teal">
                      {Math.round(lesson.durationSeconds / 5) * 5} saniye
                    </span>
                  </span>
                </button>

                {openLesson ? (
                  <div className="grid gap-2 border-t border-hm-line pt-2">
                    {lesson.videoUrl ? (
                      <a
                        href={lesson.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-hm-rose px-4 text-sm font-semibold text-white"
                      >
                        <PlayCircle className="size-5" /> Videoyu izle
                      </a>
                    ) : null}
                    <ol className="grid list-decimal gap-1.5 pl-5 text-sm text-hm-ink">
                      {lesson.steps.map((step, index) => (
                        <li key={`${lesson.id}-${index}`}>{step}</li>
                      ))}
                    </ol>
                  </div>
                ) : null}
              </SoftCard>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
