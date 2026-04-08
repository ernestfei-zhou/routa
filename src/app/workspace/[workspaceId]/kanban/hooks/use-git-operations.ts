import { useState, useCallback } from "react";

interface UseGitOperationsProps {
  workspaceId: string;
  codebaseId: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface GitOperationResult {
  success: boolean;
  error?: string;
}

export function useGitOperations({ workspaceId, codebaseId, onSuccess, onError }: UseGitOperationsProps) {
  const [loading, setLoading] = useState(false);

  const stageFiles = useCallback(async (files: string[]): Promise<GitOperationResult> => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/codebases/${codebaseId}/git/stage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files }),
        }
      );

      const data = await response.json();
      
      if (data.success) {
        onSuccess?.();
        return { success: true };
      } else {
        onError?.(data.error || "Failed to stage files");
        return { success: false, error: data.error };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to stage files";
      onError?.(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [workspaceId, codebaseId, onSuccess, onError]);

  const unstageFiles = useCallback(async (files: string[]): Promise<GitOperationResult> => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/codebases/${codebaseId}/git/unstage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files }),
        }
      );

      const data = await response.json();
      
      if (data.success) {
        onSuccess?.();
        return { success: true };
      } else {
        onError?.(data.error || "Failed to unstage files");
        return { success: false, error: data.error };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to unstage files";
      onError?.(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [workspaceId, codebaseId, onSuccess, onError]);

  const createCommit = useCallback(async (message: string, files?: string[]): Promise<GitOperationResult & { sha?: string }> => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/codebases/${codebaseId}/git/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, files }),
        }
      );

      const data = await response.json();
      
      if (data.success) {
        onSuccess?.();
        return { success: true, sha: data.sha };
      } else {
        onError?.(data.error || "Failed to create commit");
        return { success: false, error: data.error };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create commit";
      onError?.(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [workspaceId, codebaseId, onSuccess, onError]);

  const discardChanges = useCallback(async (files: string[]): Promise<GitOperationResult> => {
    // This is a destructive operation, might need confirmation
    setLoading(true);
    try {
      const response = await fetch(
        `/api/workspaces/${workspaceId}/codebases/${codebaseId}/git/discard`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files }),
        }
      );

      const data = await response.json();
      
      if (data.success) {
        onSuccess?.();
        return { success: true };
      } else {
        onError?.(data.error || "Failed to discard changes");
        return { success: false, error: data.error };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to discard changes";
      onError?.(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  }, [workspaceId, codebaseId, onSuccess, onError]);

  return {
    stageFiles,
    unstageFiles,
    createCommit,
    discardChanges,
    loading,
  };
}
