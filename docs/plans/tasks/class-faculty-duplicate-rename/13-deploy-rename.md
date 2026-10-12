# 13 Deploy rename and aliases

**Type**: HITL
**Blocked by**: 08–12

1. Do the same push steps as 03 for `feat/class-rename-aliases`.
2. If feature B merged after task 10, add the recompute call to duplicate first.
3. After the backend is live, run the recompute script on the box as a dry run and report its counts.
4. **Ask the user** before `--commit`. Take a backup first.
5. Then push the admin.
6. Prod check:
   - rename one class in one course
   - search its class title on the Classes page
   - search the course name on the Classes page
   - search an old title on the Classes page
