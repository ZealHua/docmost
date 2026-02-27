import React from "react";
import { useAtomValue } from "jotai";
import { IconLoader2 } from "@tabler/icons-react";
import { aiSubtaskProgressAtom } from "../store/ai.atoms";
import styles from "./SubtaskProgress.module.css";

export function SubtaskProgress() {
  const subtasks = useAtomValue(aiSubtaskProgressAtom);

  if (subtasks.length === 0) return null;

  return (
    <div className={styles.container}>
      {subtasks.map((task) => (
        <div key={task.task_id} className={styles.taskRow}>
          <div className={styles.statusDot}>
            {task.type === "task_running" ? (
              <IconLoader2 size={14} className={styles.spinnerIcon} />
            ) : task.type === "task_complete" ? (
              <span className={styles.completeDot} />
            ) : (
              <span className={styles.errorDot} />
            )}
          </div>
          <div className={styles.taskContent}>
            {task.message?.content || `Task ${task.task_id.slice(0, 8)}...`}
          </div>
        </div>
      ))}
    </div>
  );
}
