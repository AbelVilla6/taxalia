# Blog Article Rendering Specification

## Purpose

Render blog articles from backend data as crawlable Astro SSR/BFF pages, localized by route language and safe for SEO.

## Requirements

### Requirement: Server-side article rendering

The system MUST render public blog listing and detail pages from backend article data during SSR. Public SEO pages MUST NOT require browser-side fetching to obtain article content.

#### Scenario: Crawlable localized article page

- GIVEN a published article exists for the requested route language
- WHEN a browser or crawler requests the blog page
- THEN the HTML contains the article content in the initial response
- AND no client-side fetch is required to display the article

#### Scenario: Missing localized record

- GIVEN only the other language exists for the requested slug
- WHEN the localized detail page is requested
- THEN the page returns not found for that language

### Requirement: Language-linked publication rules

The system MUST select the article record matching the active route language and MUST hide unpublished translation groups from public listings and detail pages.

#### Scenario: Published group appears in one locale

- GIVEN a translation group is published in both languages
- WHEN the English or Spanish listing renders
- THEN the matching language record is shown
- AND the opposite language is exposed as an alternate

#### Scenario: Unpublished group is hidden

- GIVEN a translation group is unpublished
- WHEN the blog index or detail page renders
- THEN the group does not appear in public output

### Requirement: SEO and article structure output

The system MUST render article SEO metadata, hreflang alternates, canonical URL, Open Graph data, Article JSON-LD, focus keyword, secondary keywords, tags, and a table of contents when article content supports it.

#### Scenario: Full SEO payload is present

- GIVEN the backend provides SEO fields and content headings
- WHEN the article page renders
- THEN the page includes the expected metadata and structured data
- AND the table of contents reflects the article headings

#### Scenario: Optional SEO fields are missing

- GIVEN some optional SEO fields are absent
- WHEN the article page renders
- THEN the page still renders the article body
- AND omits only the missing optional tags
