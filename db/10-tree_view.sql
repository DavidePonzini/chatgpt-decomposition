BEGIN TRANSACTION;

SET search_path TO problem_decomposition;

DROP VIEW IF EXISTS v_trees;

CREATE VIEW v_trees AS
  WITH RECURSIVE tree_cte AS (
    SELECT 
      node_id,
      parent_id,
      tree_id,
      deleted,
      user_id,
      creation_mode,
      creation_ts,
      name,
      description,
      solved,
      0 AS level,
      ARRAY[]::DECIMAL[] AS path
    FROM 
      tree_nodes
    WHERE 
      parent_id IS NULL

    UNION ALL

    SELECT 
      tn.node_id,
      tn.parent_id,
      tn.tree_id,
      tn.deleted,
      tn.user_id,
      tn.creation_mode,
      tn.creation_ts,
      tn.name,
      tn.description,
      tn.solved,
      cte.level + 1,
      cte.path || tn.order_n
    FROM 
      tree_nodes tn
    INNER JOIN 
      tree_cte cte ON tn.parent_id = cte.node_id
  )

  SELECT 
    tree_id,
    path,
    level,
    node_id,
    parent_id,
    deleted,
    user_id,
    creation_mode,
    creation_ts,
    name,
    description,
    solved
  FROM 
    tree_cte
  ORDER BY 
    tree_id, path;


COMMIT;