import { useState, useEffect } from 'react';
import { X, Trash2, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CONTENT_STATUS_CONFIG, PLATFORM_CONFIG } from '@/lib/constants';

export function ContentEditModal({
  item,
  open,
  onOpenChange,
  onSave,
  onDelete,
  isNew = false,
}) {
  const [formData, setFormData] = useState({
    title: '',
    angle: '',
    description: '',
    platform: 'youtube',
    status: 'idea',
    scheduled_date: '',
    published_url: '',
    thumbnail_status: '',
    tags: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        title: item.title || '',
        angle: item.angle || '',
        description: item.description || '',
        platform: item.platform || 'youtube',
        status: item.status || 'idea',
        scheduled_date: item.scheduled_date ? item.scheduled_date.split('T')[0] : '',
        published_url: item.published_url || '',
        thumbnail_status: item.thumbnail_status || '',
        tags: item.tags?.join(', ') || '',
        notes: item.notes || '',
      });
    } else {
      setFormData({
        title: '',
        angle: '',
        description: '',
        platform: 'youtube',
        status: 'idea',
        scheduled_date: '',
        published_url: '',
        thumbnail_status: '',
        tags: '',
        notes: '',
      });
    }
  }, [item]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setSaving(true);
    try {
      const data = {
        ...formData,
        tags: formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        scheduled_date: formData.scheduled_date || null,
        published_url: formData.published_url || null,
        thumbnail_status: formData.thumbnail_status || null,
      };
      await onSave(data);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Delete this content item?')) {
      await onDelete();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isNew ? 'New Content Idea' : 'Edit Content'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Video title..."
              required
            />
          </div>

          {/* Angle */}
          <div className="space-y-2">
            <Label htmlFor="angle">Angle / Hook</Label>
            <Input
              id="angle"
              value={formData.angle}
              onChange={(e) => handleChange('angle', e.target.value)}
              placeholder="What makes this unique?"
            />
          </div>

          {/* Platform & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select
                value={formData.platform}
                onValueChange={(v) => handleChange('platform', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PLATFORM_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.emoji} {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => handleChange('status', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTENT_STATUS_CONFIG).map(([key, cfg]) => (
                    <SelectItem key={key} value={key}>
                      {cfg.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="Brief description or outline..."
              rows={3}
            />
          </div>

          {/* Scheduled Date & Thumbnail */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduled_date">Scheduled Date</Label>
              <Input
                id="scheduled_date"
                type="date"
                value={formData.scheduled_date}
                onChange={(e) => handleChange('scheduled_date', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Thumbnail</Label>
              <Select
                value={formData.thumbnail_status || 'none'}
                onValueChange={(v) => handleChange('thumbnail_status', v === 'none' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Not started" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not started</SelectItem>
                  <SelectItem value="needed">Needed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Published URL */}
          <div className="space-y-2">
            <Label htmlFor="published_url">Published URL</Label>
            <div className="flex gap-2">
              <Input
                id="published_url"
                type="url"
                value={formData.published_url}
                onChange={(e) => handleChange('published_url', e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1"
              />
              {formData.published_url && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  asChild
                >
                  <a href={formData.published_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => handleChange('tags', e.target.value)}
              placeholder="tutorial, coding, ai (comma-separated)"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes..."
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-4">
            {!isNew && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !formData.title.trim()}>
                {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
