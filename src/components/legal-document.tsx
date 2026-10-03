import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import { markerById, splitLegalText, type LegalBlock, type LegalDocument } from "@/lib/legal-content";

/**
 * Renders one legal document from the data model in `lib/legal-content`.
 *
 * Deliberate choices:
 * - The contents list is real navigation, because a legal page nobody can move
 *   around in is a legal page nobody reads.
 * - Every table scrolls horizontally inside a focusable region, so a narrow
 *   viewport does not force the page itself to scroll sideways.
 * - A review marker is announced in words, not by colour alone.
 * - Internal links go through `next/link`; external ones are marked.
 */

function RichText({ text }: { text: string }) {
  const parts = splitLegalText(text);
  return (
    <>
      {parts.map((part, i) => {
        if (typeof part === "string") return <span key={i}>{part}</span>;
        if (part.href.startsWith("http")) {
          return (
            <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className="legal-link">
              {part.label}
              <span className="legal-link-ext" aria-hidden="true">
                ↗
              </span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          );
        }
        return (
          <Link key={i} href={part.href} className="legal-link">
            {part.label}
          </Link>
        );
      })}
    </>
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "p":
      return (
        <p className="legal-p">
          <RichText text={block.text} />
        </p>
      );
    case "h3":
      return <h3 className="legal-h3">{block.text}</h3>;
    case "ul":
      return (
        <ul className="legal-list">
          {block.items.map((item, i) => (
            <li key={i}>
              <RichText text={item} />
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="legal-list">
          {block.items.map((item, i) => (
            <li key={i}>
              <RichText text={item} />
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <figure className="legal-table-figure">
          <div
            className="legal-table-scroll"
            /* Focusable so the region can be scrolled with the keyboard; a
               table wider than the viewport is otherwise unreachable. */
            tabIndex={0}
            role="region"
            aria-label={block.caption}
          >
            <table className="legal-table">
              <caption className="sr-only">{block.caption}</caption>
              <thead>
                <tr>
                  {block.head.map((cell, i) => (
                    <th key={i} scope="col">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>
                        <RichText text={cell} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </figure>
      );
    case "fact":
      return (
        <aside className="legal-fact">
          <p className="legal-fact-title">{block.title}</p>
          <p className="legal-fact-text">
            <RichText text={block.text} />
          </p>
        </aside>
      );
    case "review": {
      const marker = markerById(block.marker);
      if (!marker) return null;
      return (
        <aside className="legal-review" id={`review-${marker.id}`} aria-label={`Decision needed: ${marker.topic}`}>
          <p className="legal-review-tag">
            <span className="legal-review-dot" aria-hidden="true" />
            Decision needed
          </p>
          <p className="legal-review-topic">{marker.topic}</p>
          <p className="legal-review-question">
            <RichText text={marker.question} />
          </p>
          <p className="legal-review-current">
            <span className="legal-review-current-label">As built:</span> <RichText text={marker.current} />
          </p>
        </aside>
      );
    }
  }
}

export default function LegalDocument({ doc }: { doc: LegalDocument }) {
  const reviewCount = doc.sections
    .flatMap((section) => section.blocks)
    .filter((block) => block.kind === "review").length;

  return (
    <main id="main-content" tabIndex={-1} className="legal-main">
      <section className="page-hero">
        <div className="page-frame" aria-hidden="true">
          <span />
          <span />
        </div>
        <div className="container">
          <ScrollReveal>
            <p className="instrument-label">{doc.label}</p>
            <h1>{doc.title}</h1>
            <p>{doc.summary}</p>
            <ul className="legal-meta">
              <li>
                <span className="legal-meta-key">Version</span>
                <span className="legal-meta-val">{doc.version}</span>
              </li>
              <li>
                <span className="legal-meta-key">In effect</span>
                <span className="legal-meta-val">{doc.effective}</span>
              </li>
              <li>
                <span className="legal-meta-key">Open decisions</span>
                <span className="legal-meta-val">
                  <Link href="/legal#decisions" className="legal-link">
                    {reviewCount} in the checklist
                  </Link>
                </span>
              </li>
            </ul>
          </ScrollReveal>
        </div>
      </section>

      <div className="container legal-layout">
        <nav className="legal-toc" aria-label={`On this page: ${doc.title}`}>
          <p className="instrument-label">On this page</p>
          <ol>
            {doc.sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.heading}</a>
              </li>
            ))}
          </ol>
          <p className="legal-toc-foot">
            Marked items are deliberately unanswered. They are collected on the{" "}
            <Link href="/legal#decisions" className="legal-link">
              legal centre
            </Link>
            .
          </p>
        </nav>

        <article className="legal-body">
          {doc.sections.map((section) => (
            <section key={section.id} id={section.id} className="legal-section" aria-labelledby={`${section.id}-heading`}>
              <ScrollReveal>
                <h2 id={`${section.id}-heading`}>{section.heading}</h2>
                {section.blocks.map((block, i) => (
                  <Block key={i} block={block} />
                ))}
              </ScrollReveal>
            </section>
          ))}

          <p className="legal-end">
            End of the {doc.title}.{" "}
            <Link href="/legal" className="legal-link">
              Back to the legal centre
            </Link>
            .
          </p>
        </article>
      </div>
    </main>
  );
}