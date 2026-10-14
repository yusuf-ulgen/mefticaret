import { APP_BUILD } from "@/lib/build-version";
import { useTx } from "@/lib/landing-i18n";

export function BuildVersionBadge() {
  const tx = useTx();
  const { commit, builtAt, dirty } = APP_BUILD;
  const label = commit ? `${commit.slice(0, 8)}${dirty ? "*" : ""}` : tx("Commit bilinmiyor");
  const title = [
    commit ? `Commit: ${commit}` : tx("Commit bilinmiyor"),
    dirty ? tx("Yerel değişiklikler var") : null,
    `${tx("Derleme zamanı")}: ${builtAt}`,
  ]
    .filter(Boolean)
    .join("\n");
  const className =
    "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground";
  const content = (
    <>
      {commit ? <span>Commit</span> : null}
      <code dir="ltr" className="font-mono tabular-nums text-foreground">
        {label}
      </code>
    </>
  );

  return commit ? (
    <a
      href={`https://github.com/utebaylargrup-dot/mefticaret/commit/${commit}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
      title={title}
      aria-label={`${tx("Commit kaydını aç")}: ${label}`}
      data-build-commit={commit}
      data-build-dirty={dirty}
    >
      {content}
    </a>
  ) : (
    <span className={className} title={title} data-build-commit="unknown">
      {content}
    </span>
  );
}
