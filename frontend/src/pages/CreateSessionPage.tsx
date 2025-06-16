import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Repository } from '../hooks/useGitHub';
import { RepoSelector } from '../components/RepoSelector';
import { BranchSelector } from '../components/BranchSelector';
import { PromptEditor } from '../components/PromptEditor';
import { api } from '../utils/api';

interface SessionData {
  sessionName: string;
  repository: Repository | null;
  branch: string;
  prompt: string;
}

interface ValidationErrors {
  sessionName?: string;
  repository?: string;
  branch?: string;
  prompt?: string;
}

export const CreateSessionPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<SessionData>({
    sessionName: '',
    repository: null,
    branch: '',
    prompt: '',
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Validation function
  const validateForm = useCallback((): ValidationErrors => {
    const newErrors: ValidationErrors = {};

    if (!formData.sessionName.trim()) {
      newErrors.sessionName = 'Session name is required';
    } else if (formData.sessionName.length < 3) {
      newErrors.sessionName = 'Session name must be at least 3 characters';
    } else if (formData.sessionName.length > 50) {
      newErrors.sessionName = 'Session name must be less than 50 characters';
    }

    if (!formData.repository) {
      newErrors.repository = 'Please select a repository';
    }

    if (!formData.branch.trim()) {
      newErrors.branch = 'Please select a branch';
    }

    if (!formData.prompt.trim()) {
      newErrors.prompt = 'Please provide a prompt describing what you want to work on';
    } else if (formData.prompt.length < 10) {
      newErrors.prompt = 'Prompt should be at least 10 characters';
    } else if (formData.prompt.length > 2000) {
      newErrors.prompt = 'Prompt is too long (max 2000 characters)';
    }

    return newErrors;
  }, [formData]);

  // Handle form field changes
  const handleInputChange = (field: keyof SessionData) => (value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    setSubmitError(null);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await api.post('/api/sessions', {
        sessionName: formData.sessionName,
        repositoryUrl: formData.repository!.cloneUrl, // Use HTTPS clone URL
        branch: formData.branch,
        prompt: formData.prompt,
      });

      if (response.success && response.data) {
        // Navigate to the session terminal page
        navigate(`/terminal/${response.data.id}`);
      } else {
        setSubmitError(response.message || 'Failed to create session');
      }
    } catch (error: any) {
      console.error('Error creating session:', error);
      setSubmitError(
        error.message || 'An unexpected error occurred while creating the session'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle repository change (also clear branch when repo changes)
  const handleRepositoryChange = useCallback((repository: Repository | null) => {
    setFormData(prev => ({
      ...prev,
      repository,
      branch: repository?.defaultBranch || '', // Auto-select default branch
    }));
    
    if (errors.repository) {
      setErrors(prev => ({ ...prev, repository: '' }));
    }
    if (errors.branch) {
      setErrors(prev => ({ ...prev, branch: '' }));
    }
  }, [errors.repository, errors.branch]);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Create New Session
        </h1>
        <p className="text-gray-600">
          Set up a new coding session with your GitHub repository
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Session Name */}
        <div>
          <label htmlFor="sessionName" className="block text-sm font-medium text-gray-700 mb-2">
            Session Name
          </label>
          <input
            type="text"
            id="sessionName"
            value={formData.sessionName}
            onChange={(e) => handleInputChange('sessionName')(e.target.value)}
            placeholder="e.g., Fix authentication bug, Add user dashboard"
            disabled={isSubmitting}
            className={`
              w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-gray-50 disabled:text-gray-500
              ${errors.sessionName ? 'border-red-300' : ''}
            `}
          />
          {errors.sessionName && (
            <p className="mt-1 text-sm text-red-600">{errors.sessionName}</p>
          )}
        </div>

        {/* Repository Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Repository
          </label>
          <RepoSelector
            value={formData.repository}
            onChange={handleRepositoryChange}
            disabled={isSubmitting}
            className={errors.repository ? 'border-red-300' : ''}
          />
          {errors.repository && (
            <p className="mt-1 text-sm text-red-600">{errors.repository}</p>
          )}
          {formData.repository && (
            <div className="mt-2 p-3 bg-gray-50 rounded-md border">
              <div className="flex items-center space-x-3">
                <img
                  src={formData.repository.owner.avatarUrl}
                  alt={formData.repository.owner.login}
                  className="w-8 h-8 rounded-full"
                />
                <div>
                  <div className="font-medium text-sm">
                    {formData.repository.fullName}
                  </div>
                  {formData.repository.description && (
                    <div className="text-xs text-gray-500">
                      {formData.repository.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Branch Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Branch
          </label>
          <BranchSelector
            repository={formData.repository}
            value={formData.branch}
            onChange={handleInputChange('branch')}
            disabled={isSubmitting}
            className={errors.branch ? 'border-red-300' : ''}
          />
          {errors.branch && (
            <p className="mt-1 text-sm text-red-600">{errors.branch}</p>
          )}
        </div>

        {/* Prompt Editor */}
        <div>
          <PromptEditor
            value={formData.prompt}
            onChange={handleInputChange('prompt')}
            disabled={isSubmitting}
          />
          {errors.prompt && (
            <p className="mt-1 text-sm text-red-600">{errors.prompt}</p>
          )}
        </div>

        {/* Submit Error */}
        {submitError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <svg className="w-5 h-5 text-red-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-red-800">
                  Failed to create session
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  {submitError}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between pt-6">
          <button
            type="button"
            onClick={() => navigate('/sessions')}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={isSubmitting || Object.keys(validateForm()).length > 0}
            className="px-6 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                <span>Creating Session...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>Create Session</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Help Section */}
      <div className="mt-12 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h3 className="text-sm font-medium text-blue-800 mb-2">
          💡 Tips for a great session
        </h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Be specific about what you want to accomplish</li>
          <li>• Mention the files or areas of code you want to work on</li>
          <li>• Include any relevant context or constraints</li>
          <li>• Use the branch that contains the code you want to modify</li>
        </ul>
      </div>
    </div>
  );
};

export default CreateSessionPage;
