export function Pie() {
  return (
    <footer className="mt-auto border-t">
      <div className="mx-auto w-full max-w-[940px] px-5 py-8 text-xs text-muted-foreground sm:px-[30px]">
        <p>
          El código sigue en{" "}
          <a
            href="https://github.com/HugoCL/que-maldito-modelo-uso"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline-offset-4 hover:underline"
          >
            GitHub
          </a>
          , con licencia MIT. Las cifras siempre fueron de sus fuentes.
        </p>
      </div>
    </footer>
  );
}
