**MP3 implementation and submission plan — prepared November 2, 2026**

Due: **Tuesday, November 3, 2026, at 11:59 PM Central Time.**

**Current status — November 2:** The API is implemented, tested, pushed, and deployed. Application commit `8e48371` passed the official course self-check with **100/100 (20/20 points)** on https://cs409-mp3-zq4q.onrender.com. All 20 grader items passed. Local verification includes 6 non-database tests and a separate Atlas integration run with 7 passing tests, no failures/skips, and cleanup of its own fixtures. The integration run verifies relationships, full PUT behavior, queries, deletion, and transaction rollback. Successful DELETE returns 204 with an empty body, as confirmed by grader feedback. The public GitHub repository is https://github.com/nexusdaniel5306/mp3. `.env` remains ignored and untracked. Source disclosures are in `SOURCES.md`.

**Remaining manual steps:** Daniel will provide actual MP3 chatlog links immediately before submission; add them to `llm_logs.csv` and push that update. Then Daniel must submit the course form using his **@illinois.edu email**, NetID, public repository URL, Render base URL (without `/api`), honest time-spent answer, references, and LLM-use/survey answers. The form says it can be submitted only once. No form submission has occurred. Keep Render and Atlas available through grading.

The remaining sections retain the implementation plan and its initial baseline; unchecked checklist entries should not be read as a detailed test execution report.

**Authority and scope**

The assignment contract comes from [README.md](</Users/dli/Desktop/CS409 Web Programming/mp3/README.md>), with clarifications in [FAQ.md](</Users/dli/Desktop/CS409 Web Programming/mp3/FAQ.md>). The [MP helper guide](</Users/dli/Desktop/CS409 Web Programming/MP_HELPER_GUIDE.md>) supplies the completion workflow. The starter source establishes the existing structure, not proof that assignment features are implemented. Proposed choices below are labeled where the assignment leaves room for interpretation.

Build the specified task-management API with Node 24, Express, Mongoose, MongoDB Atlas, and Render. Creativity is limited to readable messages and simple internal organization. A frontend, authentication system, visual theme, additional product features, demo video, and GitHub Pages deployment are not part of the supplied MP3 requirements. The FAQ explicitly says no video is needed. No named staff collaborator requirement appears in these files; check the actual submission form for any additional administrative fields.

Adapt the general helper guide accordingly: API request/response and database checks replace visual/viewport checks; the starter has no production build script. Do not import MP1/MP2 requirements. Daniel has explicitly requested the same LLM disclosure format as MP2: `llm_logs.csv`, one real shareable chat URL per line, without a header. Include MP3 sessions only; do not copy the MP2 links.

November 2 follow-up: Daniel authorized local implementation by a GPT-6.1 Sol worker with high reasoning effort while he sets up Atlas. He inspected the submission form and confirmed required public GitHub repository and deployed Render API URL fields. GitHub metadata confirms the existing repository is public. Node 24.18.0 is installed locally and the worker is using it. The worker created the ignored `.env` from the example for Daniel to fill in. Publishing was subsequently authorized during wrap-up; final form submission remains Daniel’s step.

**Observed starting point**

- Working tree was clean before this planning document; the only commit is `ef7b4aa` (Initial commit).
- `origin` is `https://github.com/nexusdaniel5306/mp3.git`. Public visibility has not been verified.
- The active shell reports Node `v22.23.2`; the assignment requires Node 24.
- Dependencies already specify Express 5 and Mongoose 9. Preserve the existing dependency set unless a concrete need arises.
- `server.js` already parses JSON and URL-encoded bodies, sets CORS headers, and uses `process.env.PORT || 3000`. Database connection is commented out.
- `models/user.js` contains only a name field. There is no task model or users/tasks route implementation.
- The `/api` starter response lacks the required `data` field and prints the starter TOKEN value. Replace its placeholder response with a simple API status response; never return the database connection string.
- `.env.example` exists, `.env` does not, and `.gitignore` already ignores `.env` and dependencies.
- `submit.js` still contains the placeholder deployment URL. Its grader URL must remain unchanged.

**Requirement-to-verification matrix**

| Requirement | Planned implementation location | Evidence of completion |
|---|---|---|
| All ten method/endpoint combinations under `/api` | `routes/users.js`, `routes/tasks.js`, wired through `routes/index.js` | Exercise collection GET/POST and item GET/PUT/DELETE for both resources |
| Required User and Task schemas | Expand `models/user.js`; add `models/task.js` | Verify returned fields, types, required fields, defaults, and persisted records |
| Requirement 1: Atlas database and specified network access | Local environment and Render environment; `server.js` | Real requests persist data in Atlas; deployed API can reach it |
| Requirements 2–3: response envelopes and safe messages | Route responses and central error middleware in `server.js` | Every JSON response has `message` and `data`; no raw database errors or stack traces |
| Requirement 4: status codes | Route validation and error handling | Assert status as well as body for every success/error case; successful DELETE returns 204 with an empty body, confirmed by the grader |
| Requirement 5: database-side query handling | Small shared GET-query helper used by both route modules | Verify combinations of filtering, sorting, projection, pagination, and count; inspect use of Mongoose queries |
| Requirement 6: validation and unique emails | Models plus request validation | Reject missing/invalid fields and duplicate email on POST and PUT; allow keeping one's own email |
| Requirement 7: two-way references | Explicit mutation logic in the two route modules, using database transactions | Read both sides after each mutation and confirm failed requests preserve state |
| Secret handling | Existing `.gitignore`; environment setup | `.env` is ignored and untracked; committed source contains no database credentials |
| Deployment/self-check | Render configuration; `submit.js` API_URL | Public endpoint smoke test and recorded official self-check result |
| Administrative completion | Source record, actual LLM logs, submission form | Disclosures included, form submitted, confirmation retained |

The grading weights are creation/validation **20%**, item `select` **7.5%**, PUT of missing resources **10%**, relationship consistency **27.5%**, task query parameters **15%**, and deletion **20%**. Requirements for users' queries and other unlisted edge cases still apply even where the weight table is narrower.

**Implementation sequence — work for Codex once implementation is requested**

1. **Establish the runtime and database connection.** Select/install Node 24 explicitly rather than using an unbounded “latest” version; run the assignment's `npm install`. Constrain the project's Node engine to the 24 major series so Render does not select an incompatible future major. Read the private Atlas URI from `.env`, connect before serving database-backed requests, and keep the platform-provided port. Preserve the template's module style and dependency choices. Verify actual startup and database connectivity. Account creation and credential entry are Daniel's prerequisites below.

2. **Implement schemas, request validation, and consistent errors.** Users require name and email, with a unique email index and an empty pending-task array by default. Tasks require name and deadline; proposed optional defaults are empty description, `completed: false`, `assignedUser: ""`, and `assignedUserName: "unassigned"`. Generate `dateCreated` on the server, ignore client attempts to supply it, and preserve it on PUT. Validate incoming types before relying on database casting; an arbitrary number should not silently become a name. Do not invent restrictions such as Illinois-only email addresses or future-only deadlines. Use readable errors with `data: null` as a simple chosen error representation. Verify the email index exists before duplicate-email testing.

3. **Implement reads and query combinations.** Support `where`, `sort`, `select`, `skip`, `limit`, and `count` on both collection endpoints using Mongoose methods. Default task limit is 100; users have no default limit. Parse the supported JSON query values and return 400 for malformed applicable parameters. Item GET routes use the URL ID and only `select`; all other query parameters are ignored, including malformed values in ignored parameters. Collection no-match returns 200 with an empty list or numeric zero. Missing/malformed item URL IDs return 404. Verify combinations rather than only one parameter at a time.

4. **Implement writes and relationship maintenance together.** Implement POST, full-replacement PUT, and DELETE with the consistency rules below. Explicitly default omitted PUT fields rather than treating PUT as a patch. Validate all applicable inputs before writing. Use a database transaction for each operation that changes multiple documents so a failure cannot leave half an update behind. Attach the session to every participating operation and execute those operations sequentially. This is an implementation choice to satisfy the assignment's no-partial-changes requirement; it is not an extra product feature. Mongoose documents the transaction wrapper, rollback behavior, and restriction on parallel operations in a transaction in its [official transaction guide](https://mongoosejs.com/docs/transactions.html). Verify both ordinary behavior and rollback after an induced failure.

5. **Run a repeatable API test suite and review.** Use Node's built-in test/assert/fetch capabilities where sufficient, avoiding a new testing framework. A small integration test file can drive the API against a dedicated test database on the Atlas cluster and clean up its own fixtures. Test actual response bodies, status codes, and persisted relationships. Run `git diff --check` and inspect all changed files. Give Daniel a brief request/response walkthrough and the test results before publishing. There is no `npm run build` in this starter; do not invent a frontend build step.

6. **Publish, verify publicly, and prepare submission.** Once publishing is authorized and account setup is ready, commit/push the reviewed changes, deploy on Render, verify the live API, set only `API_URL` in `submit.js`, and run `npm run submit`. Fix feedback, rerun relevant local tests, redeploy, and repeat the self-check as needed within its rate limit. Record the final commit, deployment URL, and score. Prepare the source and LLM disclosures; Daniel completes the final form unless explicitly delegating it later.

**The exact relationship behavior we must preserve**

| Operation or transition | Required result |
|---|---|
| Create/replace an assigned pending task | Task appears in the assigned user's `pendingTasks`, once |
| Move a task from A to B | Remove it from A; assign it to B; include it in B's pending list only if incomplete |
| Complete an assigned task | Remove it from the pending list, but preserve its assignment |
| Reopen an assigned task | Add it back to the assigned user's pending list |
| Reassign an already completed task through PUT | New assignment is valid; neither user lists it as pending |
| Unassign a task | Remove its pending reference; store `""` / `"unassigned"` |
| User PUT omits `pendingTasks` | Treat it as an empty list; unassign former pending tasks |
| User POST/PUT lists another user's pending task | Move the task to this user, removing the previous reference |
| User PUT removes some pending tasks | Unassign those removed tasks |
| Rename a user | Update `assignedUserName` on every task still assigned to that user, including completed tasks |
| Delete a task | Delete the task and remove its pending reference |
| Delete a user | Unassign every task belonging to that user, including completed tasks; preserve the tasks |

An assigned task's name must match the actual user's name. If `assignedUserName` is omitted, fill it from the referenced user; if supplied and inconsistent, reject it. Reject completed tasks in a user's requested `pendingTasks`. Preserve original IDs and `dateCreated` during PUT.

Validation order matters: check the resource in the URL first (404), then field format/value and duplicate-email issues (400), then reference existence (404). Checks that require fetching a referenced record, such as whether a task is completed or whether the assigned user's name matches, occur after that record can be resolved. The FAQ gives this explicit order for user updates. No failed request may mutate any affected resource.

**Concrete verification checklist**

- [ ] Both resources: valid POST returns 201 and the resource; valid GET/PUT returns 200 and the expected resource; all JSON responses use the required envelope.
- [ ] Missing/invalid name, email, or deadline; wrong optional-field types; duplicate email on POST and PUT; own unchanged email remains valid.
- [ ] Defaults are present on POST and reapplied on PUT; client-provided `dateCreated` is ignored; PUT preserves its original value.
- [ ] Malformed and valid-but-missing URL IDs return 404 for GET, PUT, and DELETE; a missing PUT target takes precedence over an otherwise invalid parsed body.
- [ ] Malformed body reference IDs return 400; valid-but-missing references return 404; mismatched names and completed pending-task references return 400.
- [ ] Invalid requests with several affected users/tasks leave all their data unchanged; a controlled failure inside a multi-document mutation rolls back prior writes.
- [ ] Every relationship transition in the table above works from both the user and task endpoints, including POST with existing tasks.
- [ ] Repeating a successful PUT does not duplicate pending-task references.
- [ ] Collection filters include `_id`, `$in`, and `completed`; no-match results remain 200.
- [ ] Ascending/descending sort, include/exclude projection, `_id` exclusion, skip, limit, and combinations work on both collections.
- [ ] More than 100 test tasks demonstrate the default cap; more than 100 test users demonstrate no default cap. Clean only these fixtures afterward.
- [ ] Numeric count, zero matches, `count=false`, and count combined with other parameters behave according to the documented decision below.
- [ ] Both item endpoints implement `select` and ignore unrelated query parameters.
- [ ] Malformed JSON body/query errors use a sensible 400 JSON response rather than an Express HTML error page; unexpected failures use safe 500 responses.
- [ ] Successful deletes clean references; subsequent item GET and repeated DELETE return 404.
- [ ] Deployed API repeats the basic create/read/update/delete and relationship tests; official self-check passes, with any remaining discrepancy explicitly recorded.

**Ambiguities to resolve without silently inventing course requirements**

1. **DELETE status/body (resolved by official grader):** Successful DELETE must return **204 with an empty body**. The initial 200 JSON implementation lost both DELETE items; the feedback explicitly required 204/no body. Both routes and the integration tests now enforce this. JSON envelopes apply to responses with JSON content, including DELETE errors.

2. **Count and pagination:** The README says count matching documents but does not explicitly settle `count=true` combined with skip/limit. Proposed interpretation: return the total matching `where` before pagination, unaffected by select/sort. Validate the syntax of supplied applicable parameters even in count mode. Confirm through staff guidance or available grader feedback; passing an undisclosed grader does not prove every combination was tested.

3. **Mixed reference errors:** The README's broad “values before existence” wording and the FAQ's detailed user-PUT order can be read differently if the same list includes a completed task and a missing task. Follow the FAQ's explicit sequence for that case: resolve all referenced tasks, then reject completed tasks. Ask staff if they publish a different precedence.

4. **Submission/log format (format now decided):** Use `llm_logs.csv` with one real shareable MP3 chat URL per line and no header, matching Daniel's MP2 file. Actual MP3 URLs are still needed; do not invent placeholders or reuse MP2 links. Preserve implementation/debugging logs as well as this planning conversation. A summary is not a substitute for the actual log. Daniel has inspected the form and confirmed the public repository and Render URL fields; LLM disclosures and survey answers remain required by the README.

**MANUAL — Daniel's setup and submission checklist**

These are the default ownership boundaries for the later implementation. Codex can handle local coding, automated tests, configuration files, and deployment troubleshooting. Login/account decisions, secret entry, survey answers, and the final submission remain Daniel's steps unless separately delegated where feasible.

| When | Daniel's action | What unlocks the next step |
|---|---|---|
| Form inspected; clarification still optional | Daniel confirmed the public GitHub repository URL and deployed Render API URL fields. Use the MP2 log-file format as requested. DELETE is now resolved by official grader feedback; count-before-pagination remains the documented interpretation. | Known submission fields are recorded; any clarification can inform the provisional implementation |
| Verified | The existing `nexusdaniel5306/mp3` GitHub repository is public, confirmed through GitHub metadata. | No repository visibility change needed |
| Before database tests | Sign into MongoDB Atlas and create/select an assignment cluster. Create a database user with read/write access to the assignment database; these credentials are different from the Atlas account login. | A working database user and cluster |
| Before database tests | Add the README-required “Allow access from anywhere” network entry (`0.0.0.0/0`). Copy the application's connection URI and choose an explicit database name for MP3. | Local and Render processes can connect |
| Before database tests | Put the completed URI into the local ignored `.env` as `MONGODB_URI`. Leave the template TOKEN as instructed by the FAQ. Enter credentials directly in the local file, not in the chat or committed source. | Tell Codex only that the environment file is ready; it can test the connection without displaying the URI |
| Before first deployment | Sign into Render, authorize the GitHub connection, and create a Node **Web Service** for the MP3 repository. Select the intended branch and a service plan you accept. | Render has permission to build the repository |
| Before first deployment | Set Render's private `MONGODB_URI` environment variable; use the build/start settings below and confirm Node 24. | Deployment can start and reach Atlas |
| After local review | Review the implementation/test summary and authorize commit, push, and deployment. | Codex can publish the reviewed version; approval can cover the subsequent fix/redeploy cycle |
| Before final submission | Preserve/export/share all relevant LLM chatlogs in the course-accepted format, including implementation and debugging sessions, and ensure graders can access them. Review the source list. | Required disclosure artifacts are ready |
| Before the deadline | Complete the form, including your identifying information and LLM experience answers. Submit it and retain the confirmation. | Actual assignment submission is complete |
| Through grading | Keep the Render service and Atlas cluster available with working credentials and required network access. | Graders can reach the same verified API |

Render configuration for this repository:

| Setting | Planned value |
|---|---|
| Service type/runtime | Web Service / Node |
| Repository | `nexusdaniel5306/mp3` |
| Root directory | Repository root; leave blank because `package.json` is already at the root of this separate repo |
| Build command | `npm install` |
| Start command | `npm start` |
| Node version | Explicit 24.x constraint; ensure no dashboard override selects another major |
| Secret environment | `MONGODB_URI` with the actual Atlas URI |
| Port | Use Render's provided PORT through the existing server convention |
| Public base URL | Assigned `https://…onrender.com` URL |

The build/start choices follow the existing package scripts and Render's [Express deployment documentation](https://render.com/docs/deploy-node-express-app). Render supports explicit version selection through environment or repository configuration and recommends a bounded version range; see [Node version configuration](https://render.com/docs/node-version). Check which mechanism wins if a dashboard value already exists.

**Final self-check and handoff**

Set `submit.js`'s `API_URL` to the public **base URL, without `/api`**. The grader appends `/api` itself. Do not change `AUTOGRADER_URL`. Run `npm run submit` with Node 24. Warm the deployed API first if it has slept; the README warns that a run can take a minute or more and limits runs to roughly five per two minutes. Fix groups of issues between runs.

The grader creates temporary users/tasks and tries to delete them. Remove known leftover test fixtures if needed, but do not wipe the database. The FAQ requires neither an empty database nor a particular seed-data population.

Prepare a final handoff containing the public GitHub URL, verified Render URL, final commit hash, local test results, official self-check result, declared sources, actual chatlog location, and form-submission status. Do not mark MP3 submitted simply because the self-check succeeds.

**[Open the actual submission form](https://forms.gle/4V1v2VWU78XwM3H57).** The form is the submission; `submit.js` is only a self-check.

Suggested timing: finish account/credential setup and the first working deployment on November 2; use November 3 for consistency edge cases, grader feedback, disclosure, and form completion. Avoid making the first Render deployment the final step immediately before the deadline.
