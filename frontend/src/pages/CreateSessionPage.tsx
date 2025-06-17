import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Repository } from '../hooks/useGitHub';
import { RepoSelector } from '../components/RepoSelector';
import { BranchSelector } from '../components/BranchSelector';
import { api } from '../utils/api';

interface SessionData {
  sessionName: string;
  repository: Repository | null;
  branch: string;
}

interface ValidationErrors {
  sessionName?: string;
  repository?: string;
  branch?: string;
}

export const CreateSessionPage: React.FC = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<SessionData>({
    sessionName: '',
    repository: null,
    branch: '',
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
      const response = await api.post('/sessions', {
        sessionName: formData.sessionName,
        repositoryUrl: formData.repository!.cloneUrl, // Use HTTPS clone URL
        branch: formData.branch,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-gray-900 dark:to-slate-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Create New Session
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Set up a new coding session with your GitHub repository
          </p>
        </div>

        {/* Main Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Form Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4">
            <h2 className="text-lg font-semibold text-white">Session Configuration</h2>
            <p className="text-blue-100 mt-1 text-sm">Configure your development environment</p>
          </div>

          <form id="session-form" onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Session Name */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            <label htmlFor="sessionName" className="text-base font-semibold text-gray-900 dark:text-white">
              Session Name
            </label>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Give your session a descriptive name that reflects what you're working on
          </p>
          <input
            type="text"
            id="sessionName"
            value={formData.sessionName}
            onChange={(e) => handleInputChange('sessionName')(e.target.value)}
            placeholder="e.g., Fix authentication bug, Add user dashboard"
            disabled={isSubmitting}
            className={`
              w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 
              rounded-xl shadow-sm transition-all duration-200 ease-in-out
              bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm
              placeholder-gray-500 dark:placeholder-gray-400
              focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 focus:outline-none
              hover:border-gray-300 dark:hover:border-gray-500
              disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-gray-500 disabled:cursor-not-allowed
              ${errors.sessionName ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}
            `}
          />
          {errors.sessionName && (
            <div className="flex items-center space-x-2 mt-2">
              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-600">{errors.sessionName}</p>
            </div>
          )}
        </div>

        {/* Repository Selection */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <label className="text-base font-semibold text-gray-900 dark:text-white">
              Repository
            </label>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Choose the GitHub repository you want to work with
          </p>
          <RepoSelector
            value={formData.repository}
            onChange={handleRepositoryChange}
            disabled={isSubmitting}
            className={errors.repository ? 'border-red-300' : ''}
          />
          {errors.repository && (
            <div className="flex items-center space-x-2 mt-2">
              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-600">{errors.repository}</p>
            </div>
          )}
          {formData.repository && (
            <div className="mt-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <img
                    src={formData.repository.owner.avatarUrl}
                    alt={formData.repository.owner.login}
                    className="w-10 h-10 rounded-full ring-2 ring-blue-200 dark:ring-blue-700"
                  />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                    <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formData.repository.fullName}
                  </div>
                  {formData.repository.description && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {formData.repository.description}
                    </div>
                  )}
                  <div className="flex items-center space-x-3 mt-1">
                    {formData.repository.language && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1"></span>
                        {formData.repository.language}
                      </span>
                    )}
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {formData.repository.stargazersCount}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Branch Selection */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <label className="text-base font-semibold text-gray-900 dark:text-white">
              Branch
            </label>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Select the branch you want to work on
          </p>
          <BranchSelector
            repository={formData.repository}
            value={formData.branch}
            onChange={handleInputChange('branch')}
            disabled={isSubmitting}
            className={errors.branch ? 'border-red-300' : ''}
          />
          {errors.branch && (
            <div className="flex items-center space-x-2 mt-2">
              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-600">{errors.branch}</p>
            </div>
          )}
        </div>



        {/* Submit Error */}
        {submitError && (
          <div className="p-6 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
                  Failed to create session
                </h3>
                <p className="text-red-700 dark:text-red-300 mt-1">
                  {submitError}
                </p>
              </div>
            </div>
          </div>
        )}
          </form>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center pt-6 space-x-4">
          <button
            type="button"
            onClick={() => navigate('/sessions')}
            disabled={isSubmitting}
            className="px-6 py-3 text-base font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-4 focus:ring-gray-500/20 disabled:opacity-50 transition-all duration-200 ease-in-out"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            form="session-form"
            disabled={isSubmitting || Object.keys(validateForm()).length > 0}
            className="px-8 py-3 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 border border-transparent rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-in-out flex items-center space-x-3 shadow-lg hover:shadow-xl"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                <span>Creating Session...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Create Session</span>
              </>
            )}
          </button>
        </div>
        {/* Help Section */}
        <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-blue-900 dark:text-blue-100 mb-2">
                💡 Tips for a great session
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-start space-x-2">
                  <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-blue-800 dark:text-blue-200">Choose the repository you want to work on</span>
                </div>
                <div className="flex items-start space-x-2">
                  <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-blue-800 dark:text-blue-200">Select the branch you want to work on</span>
                </div>
                <div className="flex items-start space-x-2">
                  <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-blue-800 dark:text-blue-200">The repository will be automatically cloned</span>
                </div>
                <div className="flex items-start space-x-2">
                  <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-blue-800 dark:text-blue-200">Access your code through the terminal session</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateSessionPage;
