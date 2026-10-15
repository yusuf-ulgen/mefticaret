import { APP_BUILD } from "@/lib/build-version";
import { useTx } from "@/lib/landing-i18n";

export function BuildVersionBadge() {
  const tx = useTx();
  const { commit, dirty } = APP_BUILD;
  const title = tx("Commit kaydını aç");
  const className =
    "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md border border-border bg-muted/30 px-2 py-1.5 text-[11px] text-muted-foreground";
  const content = <span dir="ltr">commit</span>;

  return commit ? (
    <a
      href={`https://github.com/utebaylargrup-dot/mefticaret/commit/${commit}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${className} transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
      title={title}
      aria-label={title}
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
