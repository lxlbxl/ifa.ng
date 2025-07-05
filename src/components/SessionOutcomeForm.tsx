import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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

const formSchema = z.object({
  primaryOdu: z.string().optional(),
  otherOdus: z.string().optional(),
  ritualRecommendations: z.string().optional(),
  itemsNeeded: z.string().optional(),
  notes: z.string().optional(),
})

interface SessionOutcomeFormProps {
  onSubmit: (values: z.infer<typeof formSchema>) => void;
}

const SessionOutcomeForm: React.FC<SessionOutcomeFormProps> = ({ onSubmit }) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      primaryOdu: "",
      otherOdus: "",
      ritualRecommendations: "",
      itemsNeeded: "",
      notes: "",
    },
  })

  function handleSubmit(values: z.infer<typeof formSchema>) {
    onSubmit(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="primaryOdu"
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
          name="otherOdus"
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
          name="ritualRecommendations"
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
          name="itemsNeeded"
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
