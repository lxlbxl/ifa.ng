import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { sessionOutcomeSchema } from '@/lib/validationSchemas';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"

// Use the sessionOutcomeSchema for validation, but adapt it for the form
const formSchema = sessionOutcomeSchema.pick({
  primary_odu: true,
  ritual_recommendations: true,
  notes: true,
}).extend({
  // Form handles these as strings
  other_odus: z.string().optional(),
  items_needed: z.string().optional(),
});

// Define a type for the processed form data with correct types for submission
interface ProcessedSessionOutcome {
  primary_odu?: string;
  other_odus?: string[];
  ritual_recommendations?: string;
  items_needed?: string; // Will be stringified JSON
  notes?: string;
}

interface SessionOutcomeFormProps {
  onSubmit: (values: ProcessedSessionOutcome) => void;
}

const SessionOutcomeForm: React.FC<SessionOutcomeFormProps> = ({ onSubmit }) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      primary_odu: "",
      other_odus: "",
      ritual_recommendations: "",
      items_needed: "",
      notes: "",
    },
  })

  function handleSubmit(values: z.infer<typeof formSchema>) {
    // Process the form data to ensure proper types before submission
    const processedValues: ProcessedSessionOutcome = {
      primary_odu: values.primary_odu,
      ritual_recommendations: values.ritual_recommendations,
      notes: values.notes,
    };
    
    // Only add items if they exist
    if (values.items_needed) {
      processedValues.items_needed = JSON.stringify(parseItemsList(values.items_needed));
    }
    
    // Only add other Odus if they exist
    if (values.other_odus) {
      processedValues.other_odus = values.other_odus.split(',').map(odu => odu.trim());
    }
    
    onSubmit(processedValues);
  }

// Helper function to parse items list from a string into an array/object
function parseItemsList(itemsString: string): string[] {
  // Split by newlines or commas and trim whitespace
  return itemsString
    .split(/[\n,]/)
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="primary_odu"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Primary Odu</FormLabel>
              <FormControl>
                <Input placeholder="Enter primary odu" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="other_odus"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Other Odus</FormLabel>
              <FormControl>
                <Input placeholder="Enter other odus" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="ritual_recommendations"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ritual Recommendations</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter ritual recommendations"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="items_needed"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Items Needed</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter items needed"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Enter notes"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
};

export default SessionOutcomeForm;
