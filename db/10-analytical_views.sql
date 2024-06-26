BEGIN TRANSACTION;

SET search_path TO problem_decomposition;


CREATE OR REPLACE VIEW v_costs AS (
  SELECT
    'Decomposition' AS type,
    user_id,
    t.tree_id,
    SUM(prompt_tokens) AS tokens_in,
    SUM(completion_tokens) AS tokens_out,
    SUM(prompt_tokens) / 1000000 * .50 + SUM(completion_tokens) / 1000000 * 1.50 AS cost
  FROM decompositions d
    JOIN trees t ON t.tree_id = d.tree_id
  GROUP BY
    user_id,
    t.tree_id
  UNION ALL
  SELECT
    'Implementation' AS type,
    user_id,
    t.tree_id,
    SUM(prompt_tokens) AS tokens_in,
    SUM(completion_tokens) AS tokens_out,
    SUM(prompt_tokens) / 1000000 * .50 + SUM(completion_tokens) / 1000000 * 1.50 AS cost
  FROM implementations i
    JOIN trees t ON t.tree_id = i.tree_id
  GROUP BY
    user_id,
    t.tree_id
);

CREATE OR REPLACE VIEW v_costs_per_user AS (
  SELECT
    user_id,
    type,
    SUM(tokens_in) as tokens_in,
    SUM(tokens_out) as tokens_out,
    SUM(cost) as cost
  FROM v_costs
  GROUP BY user_id, type
);

CREATE OR REPLACE VIEW v_feedback_decomposition_avg AS (
  SELECT
    fd.user_id,
    t.tree_id,
    CASE WHEN LENGTH(root_task_name) > 15 THEN SUBSTRING(root_task_name FROM 1 FOR 15) || '...' ELSE root_task_name END AS root_task_name,
    AVG(q1) AS q1,
    AVG(q2) AS q2,
    AVG(q3) AS q3,
    AVG(q4) AS q4,
    COUNT(comments) AS comments,
    COUNT(*) AS amount
  FROM feedback_decompositions fd
    JOIN decompositions d ON fd.decomposition_id = d.decomposition_id
    JOIN trees t ON t.tree_id = d.tree_id
  GROUP BY
    fd.user_id,
    t.tree_id
);

CREATE OR REPLACE VIEW v_latest_trees AS (
  SELECT
    t.tree_id,
    user_id,
    CASE WHEN LENGTH(root_task_name) > 50 THEN SUBSTRING(root_task_name FROM 1 FOR 50) || '...' ELSE root_task_name END AS root_task_name,
    MAX(task_level) as depth
  FROM trees t
    JOIN decompositions d ON d.tree_id = t.tree_id
  GROUP BY
    t.tree_id,
    user_id,
    root_task_name
  ORDER BY t.tree_id DESC
);

COMMIT;
