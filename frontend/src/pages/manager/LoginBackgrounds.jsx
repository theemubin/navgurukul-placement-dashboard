import { useState, useEffect } from 'react';
import { Upload, Trash2, Image as ImageIcon, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { loginBackgroundAPI } from '../../services/api';

const LoginBackgrounds = () => {
  const [backgrounds, setBackgrounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchBackgrounds();
  }, []);

  const fetchBackgrounds = async () => {
    try {
      setLoading(true);
      const response = await loginBackgroundAPI.getBackgrounds();
      setBackgrounds(response.data.backgrounds || []);
    } catch (error) {
      console.error('Error fetching backgrounds:', error);
      toast.error('Failed to load login backgrounds');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    // Validate file type
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
      toast.error('Only JPEG, PNG, WEBP, and AVIF images are allowed');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('background', file);

      await loginBackgroundAPI.uploadBackground(file);

      toast.success('Background uploaded successfully');
      fetchBackgrounds();
      e.target.value = ''; // Reset file input
    } catch (error) {
      console.error('Error uploading background:', error);
      toast.error(error.response?.data?.message || 'Failed to upload background');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename) => {
    if (!window.confirm('Delete this login background? This action cannot be undone.')) {
      return;
    }

    try {
      await loginBackgroundAPI.deleteBackground(filename);
      toast.success('Background deleted');
      fetchBackgrounds();
    } catch (error) {
      console.error('Error deleting background:', error);
      toast.error('Failed to delete background');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Login Background Images</h1>
        <p className="text-gray-600">
          Manage the background images that appear on the login page. Images are randomly selected on each page load.
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <Upload className="w-8 h-8 text-primary-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Upload New Background</h2>
            <p className="text-sm text-gray-600 mb-4">
              Recommended: High-resolution images (1920x1080 or larger) in JPEG, PNG, WEBP, or AVIF format. Max 10MB.
            </p>
            <div className="flex items-center gap-4">
              <label className="relative cursor-pointer">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/avif"
                  onChange={handleUpload}
                  disabled={uploading}
                  className="hidden"
                />
                <span className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed">
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Choose Image
                    </>
                  )}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Info Alert */}
      {backgrounds.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-900">No backgrounds uploaded yet</h3>
              <p className="text-sm text-blue-700 mt-1">
                Upload your first background image to get started. A random image will be displayed on the login page each time it loads.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Backgrounds Grid */}
      {backgrounds.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {backgrounds.map((bg) => (
            <div
              key={bg.filename}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Image Preview */}
              <div className="relative aspect-video bg-gray-100">
                <img
                  src={bg.url}
                  alt={bg.filename}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#f3f4f6" width="100" height="100"/><text x="50" y="50" text-anchor="middle" fill="#9ca3af" font-size="12">No Preview</text></svg>');
                  }}
                />
                <div className="absolute top-2 right-2">
                  <button
                    onClick={() => handleDelete(bg.filename)}
                    className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-lg transition-colors"
                    title="Delete background"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Image Info */}
              <div className="p-4">
                <div className="flex items-start gap-2 mb-2">
                  <ImageIcon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-gray-900 truncate" title={bg.filename}>
                    {bg.filename}
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{formatFileSize(bg.size)}</span>
                  <span>{formatDate(bg.uploadedAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Usage Instructions */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6 border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">How it works</h3>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-primary-600 font-bold">•</span>
            <span>Each time a user visits the login page, a random background from this collection is displayed.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-600 font-bold">•</span>
            <span>Images are automatically scaled to cover the full screen while maintaining aspect ratio.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-600 font-bold">•</span>
            <span>For best results, use high-quality images with a resolution of at least 1920x1080 pixels.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary-600 font-bold">•</span>
            <span>Changes take effect immediately - no need to restart the server or rebuild the frontend.</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default LoginBackgrounds;
