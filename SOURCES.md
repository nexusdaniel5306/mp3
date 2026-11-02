**MP3 source disclosure**

Assignment requirements and starter code:

- The course-provided `README.md`, `FAQ.md`, and starter files in this repository.
- The local `MP_HELPER_GUIDE.md` for the assignment-completion workflow.
- The professor's Render setup slide supplied as a screenshot, and feedback from the course-provided `submit.js` autograder.

External documentation consulted during planning and implementation:

- [Mongoose transactions](https://mongoosejs.com/docs/transactions.html): multi-document updates, transaction sessions, and rollback.
- [Mongoose Query API](https://mongoosejs.com/docs/api/query.html): database-side filtering, sorting, selection, pagination, and counts.
- [Render Express deployment](https://render.com/docs/deploy-node-express-app): service type and build/start configuration.
- [Render Node version configuration](https://render.com/docs/node-version): selecting Node 24 and avoiding an unbounded version range.
- [HTTP semantics, section 15.3.5](https://www.rfc-editor.org/rfc/rfc9110.html#section-15.3.5): a 204 response cannot contain a JSON body.
- [MongoDB connection strings](https://www.mongodb.com/docs/manual/reference/connection-string/): Atlas URI format and credential encoding.
- [Atlas database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/): database credentials and access roles.
- [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/): required network access configuration.
- [Render Free instances](https://render.com/docs/free): selecting the Free service tier and understanding idle startup behavior.

LLM assistance:

- OpenAI Codex assisted with interpreting requirements, planning, implementation, and verification. The implementation worker used GPT-6.1 Sol with high reasoning effort; the evaluation worker used GPT-6 Luna with high reasoning effort.
- `llm_logs.csv` follows the same format as MP2: one actual shareable MP3 conversation URL per line, with no header.
- **Pending before submission:** add the real MP3 chatlog URLs, including the implementation/debugging assistance, and complete the course's LLM survey answers. The empty log file is not a completed disclosure.
