# Delta for Blog API

## ADDED Requirements

### Requirement: Locale-scoped article responses

The public blog API MUST return article records scoped to the requested language and MUST reject unsupported languages. Responses MUST include the active language, translationGroupId, and publication state.

#### Scenario: Language-filtered list and detail reads

- GIVEN a request is made with `lang=es` or `lang=en`
- WHEN the public list or detail endpoint responds
- THEN only records for that language are returned
- AND each record includes its translation group and publish state

#### Scenario: Unsupported language is rejected

- GIVEN a request uses an unsupported language code
- WHEN the API validates the request
- THEN it returns a validation error

### Requirement: SEO-ready article payloads

The public blog API MUST provide SEO-ready article fields for rendering canonical metadata, alternates, social previews, tags, and table-of-contents content.

#### Scenario: Complete article payload

- GIVEN an article is requested from the API
- WHEN the response is serialized
- THEN it includes meta title, meta description, canonical URL, focus keyword, secondary keywords, tags, Open Graph data, Article JSON-LD data, and body content

#### Scenario: Content supports table of contents

- GIVEN the article body contains headings
- WHEN the API returns the record
- THEN the body content is suitable for generating a table of contents

### Requirement: Translation-group publication consistency

The blog API MUST treat publish and unpublish as translation-group operations and MUST require translated records to be linked by a shared translationGroupId at creation time.

#### Scenario: Linked translations are created together

- GIVEN a new translated article record is created
- WHEN the translation is saved
- THEN it is associated with the shared translation group
- AND both language records can be resolved as alternates

#### Scenario: Group publish state is shared

- GIVEN one language record in a translation group is unpublished
- WHEN publication state is evaluated for public output
- THEN the entire translation group is treated as unpublished
