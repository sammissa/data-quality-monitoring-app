WITH KeywordStats AS (
 SELECT
  keyword,
  COUNT(*) AS question_answer_pairs
 FROM ${DATABASE}.${TABLE}
 WHERE partition_0 = ?
 GROUP BY keyword
),
OverallStats AS (
 SELECT
  COUNT(*) AS total_keywords,
  SUM(CASE WHEN question_answer_pairs >= 4 THEN 1 ELSE 0 END) AS keywords_with_valid_qa_pairs,
  COUNT(*) - SUM(CASE WHEN question_answer_pairs >= 4 THEN 1 ELSE 0 END) AS keywords_with_invalid_qa_pairs,
  CAST(SUM(CASE WHEN question_answer_pairs >= 4 THEN 1 ELSE 0 END) AS DOUBLE) / CAST(COUNT(*) AS DOUBLE) AS pass_percentage
 FROM KeywordStats
)
SELECT
 total_keywords,
 keywords_with_valid_qa_pairs,
 keywords_with_invalid_qa_pairs,
 pass_percentage,
 CASE WHEN pass_percentage >= 0.95 THEN true ELSE false END AS success
FROM OverallStats;